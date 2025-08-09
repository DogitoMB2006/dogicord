module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  const versionInfo = {
    timestamp: Date.now().toString(),
    buildDate: new Date().toISOString(),
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || 'main',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    deploymentUrl: process.env.VERCEL_URL || 'localhost',
    deploymentId: process.env.VERCEL_GIT_COMMIT_SHA
      ? `vercel-${String(process.env.VERCEL_GIT_COMMIT_SHA).substring(0, 8)}-${Date.now()}`
      : `api-${Date.now()}`,
    region: process.env.VERCEL_REGION || 'unknown',
    isVercel: true,
    apiResponse: true,
    version: '1.0.0'
  }

  res.status(200).json(versionInfo)
}
