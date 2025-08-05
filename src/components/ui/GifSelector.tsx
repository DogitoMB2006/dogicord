
import { useState, useEffect, useRef } from 'react'

interface GifSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelectGif: (gifUrl: string) => void
  isMobile: boolean
}

const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'
const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs'

export default function GifSelector({ isOpen, onClose, onSelectGif, isMobile }: GifSelectorProps) {
  const [gifs, setGifs] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadTrendingGifs()
    }
  }, [isOpen])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (searchTerm.trim()) {
        searchGifs(searchTerm.trim())
      } else {
        loadTrendingGifs()
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  const loadTrendingGifs = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `${GIPHY_BASE_URL}/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g&fmt=json`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.data) {
        setGifs(data.data)
        setOffset(20)
        setHasMore(data.data.length === 20)
      }
    } catch (error) {
      console.error('Error loading trending GIFs:', error)
      setGifs([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const searchGifs = async (query: string, append = false) => {
    setLoading(true)
    try {
      const currentOffset = append ? offset : 0
      const response = await fetch(
        `${GIPHY_BASE_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&offset=${currentOffset}&rating=g&fmt=json`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.data) {
        setGifs(prev => append ? [...prev, ...data.data] : data.data)
        setOffset(currentOffset + 20)
        setHasMore(data.data.length === 20)
      }
    } catch (error) {
      console.error('Error searching GIFs:', error)
      if (!append) {
        setGifs([])
        setHasMore(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    
    if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !loading) {
      if (searchTerm.trim()) {
        searchGifs(searchTerm.trim(), true)
      } else {
        loadMoreTrending()
      }
    }
  }

  const loadMoreTrending = async () => {
    if (loading || !hasMore) return
    
    setLoading(true)
    try {
      const response = await fetch(
        `${GIPHY_BASE_URL}/trending?api_key=${GIPHY_API_KEY}&limit=20&offset=${offset}&rating=g&fmt=json`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.data) {
        setGifs(prev => [...prev, ...data.data])
        setOffset(prev => prev + 20)
        setHasMore(data.data.length === 20)
      }
    } catch (error) {
      console.error('Error loading more GIFs:', error)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const handleGifSelect = (gif: any) => {
    const gifUrl = gif.images?.fixed_height?.url || gif.images?.original?.url
    if (gifUrl) {
      onSelectGif(gifUrl)
      onClose()
    }
  }

  const handleClose = () => {
    setSearchTerm('')
    setGifs([])
    setOffset(0)
    setHasMore(true)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={`absolute ${isMobile ? 'bottom-16 left-2 right-2' : 'bottom-14 left-4'} z-50`}>
      <div className={`bg-gray-800 border border-gray-600 rounded-lg shadow-2xl ${
        isMobile ? 'h-80' : 'w-96 h-96'
      }`}>
        <div className="p-3 border-b border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-semibold text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
              GIFs
            </h3>
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for GIFs..."
              className={`w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 ${
                isMobile ? 'text-sm' : 'text-base'
              }`}
            />
            <svg 
              className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div 
          ref={containerRef}
          onScroll={handleScroll}
          className={`overflow-y-auto ${isMobile ? 'h-60' : 'h-80'} p-2`}
        >
          {gifs.length === 0 && !loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V1a1 1 0 011-1h2a1 1 0 011 1v18a1 1 0 01-1 1H4a1 1 0 01-1-1V1a1 1 0 011-1h2a1 1 0 011 1v3m0 0h8m-8 0H5a1 1 0 00-1 1v3m0 0h16" />
                  </svg>
                </div>
                <p className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-base'}`}>
                  {searchTerm ? 'No GIFs found' : 'Search for GIFs'}
                </p>
              </div>
            </div>
          ) : (
            <div className={`grid gap-2 ${isMobile ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {gifs.map((gif) => (
                <div
                  key={gif.id}
                  onClick={() => handleGifSelect(gif)}
                  className="relative cursor-pointer rounded-lg overflow-hidden hover:ring-2 hover:ring-slate-500 transition-all group"
                >
                  <img
                    src={gif.images?.fixed_height_small?.url || gif.images?.fixed_height?.url}
                    alt={gif.title || 'GIF'}
                    className="w-full h-24 object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        <div className="p-2 border-t border-gray-600">
          <div className="flex items-center justify-center">
            <span className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
              Powered by GIPHY
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}