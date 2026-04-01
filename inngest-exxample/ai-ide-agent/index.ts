process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import app from './app'
import { AI_IDE_PORT } from './utils/config'

// Bind to 0.0.0.0 to accept connections from both IPv4 and IPv6
app.listen(AI_IDE_PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${AI_IDE_PORT}`)
})