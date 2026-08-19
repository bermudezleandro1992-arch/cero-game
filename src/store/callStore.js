import { create } from 'zustand'

export const useCallStore = create(set => ({
  incomingCall: null,  // { from, fromName, convId, callType, offer }
  activeCall: null,    // { convId, contact, callType, isIncoming, offer }
  inCall: false,       // true whenever ANY CallPage is mounted

  setIncomingCall: (call) => set({ incomingCall: call }),
  setActiveCall:   (call) => set({ activeCall: call }),
  setInCall:       (v)    => set({ inCall: v }),
  clearCall:       ()     => set({ incomingCall: null, activeCall: null, inCall: false }),
}))
