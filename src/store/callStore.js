import { create } from 'zustand'

export const useCallStore = create(set => ({
  incomingCall: null,  // { from, fromName, convId, callType, offer }
  activeCall: null,    // { convId, contact, callType, isIncoming, offer }

  setIncomingCall: (call) => set({ incomingCall: call }),
  setActiveCall:   (call) => set({ activeCall: call }),
  clearCall:       ()     => set({ incomingCall: null, activeCall: null }),
}))
