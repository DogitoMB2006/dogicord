import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Generate version information for update detection
function generateVersion() {
  const timestamp = Date.now()
  const buildDate = new Date().toISOString()
  
  // Read package.json for version
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'))
  const version = packageJson.version || '1.0.0'
  
  // Create version info object
  const versionInfo = {
    version,
    timestamp: timestamp.toString(),
    buildDate,
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || 'main',
    environment: process.env.NODE_ENV || 'development',
    deploymentUrl: process.env.VERCEL_URL || 'localhost',
    description: `Build ${timestamp} - ${buildDate}`
  }
  
  // Write to public/version.json
  const versionPath = path.join(__dirname, '../public/version.json')
  fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2))
  
  // Update index.html with build time
  const indexPath = path.join(__dirname, '../index.html')
  let indexContent = fs.readFileSync(indexPath, 'utf8')
  
  // Update build-time meta tag
  indexContent = indexContent.replace(
    /<meta name="build-time" content="[^"]*" \/>/,
    `<meta name="build-time" content="${timestamp}" />`
  )
  
  // Update app-version meta tag
  indexContent = indexContent.replace(
    /<meta name="app-version" content="[^"]*" \/>/,
    `<meta name="app-version" content="${version}" />`
  )
  
  fs.writeFileSync(indexPath, indexContent)
  
  console.log('✅ Version info generated:', versionInfo)
  return versionInfo
}

// Run the script
generateVersion()

export default generateVersion
