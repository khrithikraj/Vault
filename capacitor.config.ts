import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.khrithikraj.vault',
  appName: "Raj's Vault",
  webDir: 'dist',
  backgroundColor: '#140C07',
  server: {
    androidScheme: 'https',
  },
  android: {
    adjustMarginsForEdgeToEdge: 'force',
  },
}

export default config
