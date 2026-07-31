"use client";

import { ref, set, onValue, off, remove, push, onChildAdded, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

// Public STUN only — works for most home networks doing direct peer-to-peer.
// A TURN server (e.g. a paid/self-hosted coturn, or a free-tier provider)
// would make connections through stricter NATs/firewalls more reliable, but
// isn't required to get calls working for the common case.
export const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export function callConversationId(codeA: string, codeB: string): string {
  return [codeA, codeB].sort().join("_");
}

export interface IncomingCallPayload {
  fromCode: string;
  fromDisplayName: string;
  convId: string;
  createdAt: number;
}

export function ringFriend(targetCode: string, fromCode: string, fromDisplayName: string, convId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Voice calls aren't set up yet."));
  return set(ref(db, `incomingCalls/${targetCode}`), { fromCode, fromDisplayName, convId, createdAt: Date.now() });
}

export function listenForIncomingCalls(myCode: string, callback: (call: IncomingCallPayload | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const callRef = ref(db, `incomingCalls/${myCode}`);
  const handler = onValue(callRef, (snapshot) => callback(snapshot.val()));
  return () => off(callRef, "value", handler);
}

export function clearIncomingCall(myCode: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `incomingCalls/${myCode}`));
}

export function sendOffer(convId: string, fromCode: string, sdp: RTCSessionDescriptionInit) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Voice calls aren't set up yet."));
  return set(ref(db, `calls/${convId}/offer`), { fromCode, sdp: JSON.stringify(sdp) });
}

export function listenForOffer(convId: string, callback: (sdp: RTCSessionDescriptionInit | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const offerRef = ref(db, `calls/${convId}/offer`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val();
    callback(val ? JSON.parse(val.sdp) : null);
  };
  onValue(offerRef, handler);
  return () => off(offerRef, "value", handler);
}

export function sendAnswer(convId: string, sdp: RTCSessionDescriptionInit) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Voice calls aren't set up yet."));
  return set(ref(db, `calls/${convId}/answer`), { sdp: JSON.stringify(sdp) });
}

export function listenForAnswer(convId: string, callback: (sdp: RTCSessionDescriptionInit | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const answerRef = ref(db, `calls/${convId}/answer`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val();
    callback(val ? JSON.parse(val.sdp) : null);
  };
  onValue(answerRef, handler);
  return () => off(answerRef, "value", handler);
}

export function sendIceCandidate(convId: string, fromCode: string, candidate: RTCIceCandidateInit) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return push(ref(db, `calls/${convId}/candidates/${fromCode}`), JSON.stringify(candidate));
}

export function listenForIceCandidates(convId: string, peerCode: string, callback: (candidate: RTCIceCandidateInit) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const candRef = ref(db, `calls/${convId}/candidates/${peerCode}`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val();
    if (val) callback(JSON.parse(val));
  };
  onChildAdded(candRef, handler);
  return () => off(candRef, "child_added", handler);
}

export function listenForHangup(convId: string, callback: () => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const hangupRef = ref(db, `calls/${convId}/hangup`);
  const handler = (snapshot: DataSnapshot) => {
    if (snapshot.val()) callback();
  };
  onValue(hangupRef, handler);
  return () => off(hangupRef, "value", handler);
}

export function signalHangup(convId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return set(ref(db, `calls/${convId}/hangup`), Date.now());
}

export function clearCallRoom(convId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `calls/${convId}`));
}
