import { useState, useEffect } from 'react'
import { updateService } from '../services/updateService'

interface UpdateInfo {
  hasUpdate: boolean
  currentVersion: string | null
  latestVersion: string | null
  isModalOpen: boolean
  checkForUpdates: () => Promise<boolean>
  applyUpdate: () => void
  dismissUpdate: () => void
  simulateUpdate: () => void
  forceCheckForUpdates: () => Promise<void>
}

export const useAppUpdate = (): UpdateInfo => {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [versionInfo, setVersionInfo] = useState({
    current: null as string | null,
    latest: null as string | null
  })

  useEffect(() => {
    // Subscribe to update notifications
    const unsubscribe = updateService.subscribeToUpdates(() => {
      const info = updateService.getVersionInfo()
      setHasUpdate(info.hasUpdate)
      setVersionInfo({
        current: info.current,
        latest: info.latest
      })
      
      if (info.hasUpdate) {
        setIsModalOpen(true)
      }
    })

    // Initial check
    const checkInitialUpdate = async () => {
      const info = updateService.getVersionInfo()
      setHasUpdate(info.hasUpdate)
      setVersionInfo({
        current: info.current,
        latest: info.latest
      })
      
      if (info.hasUpdate) {
        setIsModalOpen(true)
      }
    }

    checkInitialUpdate()

    // Cleanup on unmount
    return () => {
      unsubscribe()
    }
  }, [])

  const checkForUpdates = async (): Promise<boolean> => {
    const hasNewUpdate = await updateService.checkForUpdates()
    const info = updateService.getVersionInfo()
    
    setHasUpdate(info.hasUpdate)
    setVersionInfo({
      current: info.current,
      latest: info.latest
    })
    
    if (info.hasUpdate) {
      setIsModalOpen(true)
    }
    
    return hasNewUpdate
  }

  const applyUpdate = (): void => {
    setIsModalOpen(false)
    updateService.applyUpdate()
  }

  const dismissUpdate = (): void => {
    setIsModalOpen(false)
    updateService.dismissUpdate()
    setHasUpdate(false)
  }

  const simulateUpdate = (): void => {
    updateService.simulateUpdate()
  }

  const forceCheckForUpdates = async (): Promise<void> => {
    await updateService.forceCheckForUpdates()
  }

  return {
    hasUpdate,
    currentVersion: versionInfo.current,
    latestVersion: versionInfo.latest,
    isModalOpen,
    checkForUpdates,
    applyUpdate,
    dismissUpdate,
    simulateUpdate,
    forceCheckForUpdates
  }
}
