import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function postBuild() {
  console.log('🔧 Running post-build optimizations...')
  
  const distPath = path.join(__dirname, '../dist')
  const indexPath = path.join(distPath, 'index.html')
  
  if (!fs.existsSync(indexPath)) {
    console.log('⚠️ index.html not found in dist, skipping post-build')
    return
  }
  
  // Read the built index.html
  let indexContent = fs.readFileSync(indexPath, 'utf8')
  
  // Add runtime deployment detection
  const deploymentScript = `
    <script>
      // Runtime deployment detection for Vercel
      window.__DEPLOYMENT_INFO__ = {
        buildTime: '${Date.now()}',
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        location: window.location.href
      };
      
      // Enhanced update detection
      if (window.updateService && typeof window.updateService.checkForUpdates === 'function') {
        // Force check after 10 seconds
        setTimeout(() => {
          console.log('🔍 Forced update check after page load');
          window.updateService.checkForUpdates();
        }, 10000);
      }
    </script>
  `
  
  // Insert the script before closing body tag
  indexContent = indexContent.replace(
    '</body>',
    `${deploymentScript}</body>`
  )
  
  // Write the modified index.html back
  fs.writeFileSync(indexPath, indexContent)
  
  console.log('✅ Post-build optimizations completed')
}

// Run if called directly
postBuild()
