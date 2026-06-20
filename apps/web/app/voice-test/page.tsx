"use client";

import { useState, useRef, useEffect } from "react";
import * as mediasoupClient from "mediasoup-client";
import { socket } from "@/lib/socket";

const TEST_CHANNEL_ID = "voice-test-channel-1";

export default function VoiceTestPage() {
  const [status, setStatus] = useState("Not connected");
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);

  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const producerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const consumersRef = useRef<Map<string, mediasoupClient.types.Consumer>>(new Map());

  function emitWithAck(event: string, data: any): Promise<any> {
    return new Promise((resolve) => {
      socket.emit(event, data, resolve);
    });
  }

  async function consumeProducer(producerId: string) {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;
    if (!device || !recvTransport) return;

    const response = await emitWithAck("voice:consume", {
      channelId: TEST_CHANNEL_ID,
      transportId: recvTransport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });

    if (response.error) {
      console.error("Consume error:", response.error);
      return;
    }

    const consumer = await recvTransport.consume(response.params);
    consumersRef.current.set(consumer.id, consumer);

    const stream = new MediaStream([consumer.track]);

    const audioEl = document.createElement("audio");
    audioEl.srcObject = stream;
    audioEl.autoplay = true;
    audioEl.dataset.consumerId = consumer.id;
    audioContainerRef.current?.appendChild(audioEl);

    console.log("Now consuming producer:", producerId);
  }

  async function joinVoiceChannel() {
    try {
      setStatus("Connecting socket...");
      socket.connect();

      setStatus("Joining voice channel...");
      const joinResponse = await emitWithAck("voice:join", {
        channelId: TEST_CHANNEL_ID,
      });

      if (joinResponse.error) {
        setStatus("Error: " + joinResponse.error);
        return;
      }

      setStatus("Loading mediasoup Device...");
      const device = new mediasoupClient.Device();
      await device.load({ routerRtpCapabilities: joinResponse.rtpCapabilities });
      deviceRef.current = device;

      setStatus("Creating send transport...");
      const sendTransportResponse = await emitWithAck("voice:createTransport", {
        channelId: TEST_CHANNEL_ID,
      });

      const sendTransport = device.createSendTransport(sendTransportResponse.params);

      sendTransport.on("connect", async (params: any, callback: any, errback: any) => {
        try {
          await emitWithAck("voice:connectTransport", {
            transportId: sendTransport.id,
            dtlsParameters: params.dtlsParameters,
          });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      });

      sendTransport.on("produce", async (params: any, callback: any, errback: any) => {
        try {
          const response = await emitWithAck("voice:produce", {
            channelId: TEST_CHANNEL_ID,
            transportId: sendTransport.id,
            kind: params.kind,
            rtpParameters: params.rtpParameters,
          });
          callback({ id: response.id });
        } catch (err) {
          errback(err as Error);
        }
      });

      setStatus("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0];

      const producer = await sendTransport.produce({ track: audioTrack });
      producerRef.current = producer;

      setStatus("Creating receive transport...");
      const recvTransportResponse = await emitWithAck("voice:createTransport", {
        channelId: TEST_CHANNEL_ID,
      });

      const recvTransport = device.createRecvTransport(recvTransportResponse.params);
      recvTransportRef.current = recvTransport;

      recvTransport.on("connect", async (params: any, callback: any, errback: any) => {
        try {
          await emitWithAck("voice:connectTransport", {
            transportId: recvTransport.id,
            dtlsParameters: params.dtlsParameters,
          });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      });

      socket.on("voice:newProducer", (data: { producerId: string }) => {
        consumeProducer(data.producerId);
      });

      const producersResponse = await emitWithAck("voice:getProducers", {
        channelId: TEST_CHANNEL_ID,
      });

      for (const p of producersResponse.producers) {
        await consumeProducer(p.producerId);
      }

      setStatus(
        "SUCCESS - Connected, mic streaming, listening for others (" +
          producersResponse.producers.length +
          " other producer(s) found)"
      );
    } catch (err: any) {
      console.error(err);
      setStatus("Error: " + err.message);
    }
  }

  function toggleMute() {
    const producer = producerRef.current;
    if (!producer) return;

    const muting = !isMuted;
    if (muting) {
      producer.pause();
    } else {
      producer.resume();
    }
    setIsMuted(muting);
  }

  function toggleDeafen() {
    const deafening = !isDeafened;

    consumersRef.current.forEach((consumer) => {
      if (deafening) {
        consumer.pause();
      } else {
        consumer.resume();
      }
    });

    if (deafening && !isMuted) {
      toggleMute();
    }

    setIsDeafened(deafening);
  }

  function togglePushToTalk() {
    setIsPushToTalk(!isPushToTalk);
  }

  useEffect(() => {
    if (!isPushToTalk) return;

    const producer = producerRef.current;
    if (!producer) return;

    producer.pause();
    setIsMuted(true);

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && producerRef.current) {
        producerRef.current.resume();
        setIsMuted(false);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space" && producerRef.current) {
        producerRef.current.pause();
        setIsMuted(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isPushToTalk]);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Voice channel test</h1>
      <p>Status: {status}</p>

      <button onClick={joinVoiceChannel} style={{ padding: "10px 20px", marginBottom: "1rem" }}>
        Join Voice Channel (with mic)
      </button>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={toggleMute}
          style={{
            padding: "8px 16px",
            background: isMuted ? "#d9534f" : "#eee",
            color: isMuted ? "#fff" : "#000",
          }}
        >
          {isMuted ? "🔇 Unmute" : "🎤 Mute"}
        </button>

        <button
          onClick={toggleDeafen}
          style={{
            padding: "8px 16px",
            background: isDeafened ? "#d9534f" : "#eee",
            color: isDeafened ? "#fff" : "#000",
          }}
        >
          {isDeafened ? "🔕 Undeafen" : "🔊 Deafen"}
        </button>

        <button
          onClick={togglePushToTalk}
          style={{
            padding: "8px 16px",
            background: isPushToTalk ? "#5cb85c" : "#eee",
            color: isPushToTalk ? "#fff" : "#000",
          }}
        >
          Push-to-talk: {isPushToTalk ? "ON" : "OFF"}
        </button>
      </div>

      <div ref={audioContainerRef} />
    </main>
  );
}