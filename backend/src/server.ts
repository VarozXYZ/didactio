import { getAppEnv, loadEnv } from './config/env.js'
import { createApp } from './app.js'

loadEnv()

const { port } = getAppEnv()
const app = createApp()

app.listen(port, () => {
    console.log(`Didactio backend listening on http://localhost:${port}`)
})
