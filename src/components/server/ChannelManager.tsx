import { useState } from 'react'
import type { Channel, Category, ChannelPermission } from '../../types/channels'
import type { Role } from '../../types/permissions'
import ChannelEditor from './ChannelEditor'
import CategoryEditor from './CategoryEditor'

interface ChannelManagerProps {
  channels: Channel[]
  categories: Category[]
  roles: Role[]
  userRoles: Role[]
  isOwner: boolean
  onCreateChannel: (name: string, type: 'text' | 'voice', categoryId: string, permissions: ChannelPermission[]) => Promise<void>
  onUpdateChannel: (channelId: string, updates: Partial<Channel>) => Promise<void>
  onDeleteChannel: (channelId: string) => Promise<void>
  onCreateCategory: (name: string, permissions: ChannelPermission[]) => Promise<void>
  onUpdateCategory: (categoryId: string, updates: Partial<Category>) => Promise<void>
  onDeleteCategory: (categoryId: string) => Promise<void>
  isMobile: boolean
}

export default function ChannelManager({
  channels,
  categories,
  roles,
  userRoles,
  isOwner,
  onCreateChannel,
  onUpdateChannel,
  onDeleteChannel,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  isMobile
}: ChannelManagerProps) {
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [showChannelForm, setShowChannelForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')

  const hasPermission = (permission: string): boolean => {
    if (isOwner) return true
    return userRoles.some(role => 
      role.permissions.includes('administrator') || 
      role.permissions.includes(permission)
    )
  }

  const organizedChannels = categories
    .sort((a, b) => a.position - b.position)
    .map(category => ({
      category,
      channels: channels
        .filter(ch => ch.categoryId === category.id)
        .sort((a, b) => a.position - b.position)
    }))

  const uncategorizedChannels = channels
    .filter(ch => !categories.find(cat => cat.id === ch.categoryId))
    .sort((a, b) => a.position - b.position)

  if (editingChannel) {
    return (
      <ChannelEditor
        channel={editingChannel}
        categories={categories}
        roles={roles}
        userRoles={userRoles}
        isOwner={isOwner}
        onSave={async (updates) => {
          await onUpdateChannel(editingChannel.id, updates)
          setEditingChannel(null)
        }}
        onCreate={async () => {}}
        onCancel={() => setEditingChannel(null)}
        onDelete={async () => {
          await onDeleteChannel(editingChannel.id)
          setEditingChannel(null)
        }}
        isMobile={isMobile}
      />
    )
  }

  if (editingCategory) {
    return (
      <CategoryEditor
        category={editingCategory}
        roles={roles}
        userRoles={userRoles}
        isOwner={isOwner}
        onSave={async (updates) => {
          await onUpdateCategory(editingCategory.id, updates)
          setEditingCategory(null)
        }}
        onCreate={async () => {}}
        onCancel={() => setEditingCategory(null)}
        onDelete={async () => {
          await onDeleteCategory(editingCategory.id)
          setEditingCategory(null)
        }}
        isMobile={isMobile}
      />
    )
  }

  if (showChannelForm) {
    return (
      <ChannelEditor
        channel={null}
        categories={categories}
        roles={roles}
        userRoles={userRoles}
        isOwner={isOwner}
        selectedCategoryId={selectedCategoryId}
        onSave={async () => {}}
        onCreate={async (name: string, type: 'text' | 'voice', categoryId: string, permissions: ChannelPermission[]) => {
          await onCreateChannel(name, type, categoryId, permissions)
          setShowChannelForm(false)
          setSelectedCategoryId('')
        }}
        onCancel={() => {
          setShowChannelForm(false)
          setSelectedCategoryId('')
        }}
        isMobile={isMobile}
      />
    )
  }

  if (showCategoryForm) {
    return (
      <CategoryEditor
        category={null}
        roles={roles}
        userRoles={userRoles}
        isOwner={isOwner}
        onSave={async () => {}}
        onCreate={async (name: string, permissions: ChannelPermission[]) => {
          await onCreateCategory(name, permissions)
          setShowCategoryForm(false)
        }}
        onCancel={() => setShowCategoryForm(false)}
        isMobile={isMobile}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-white ${isMobile ? 'text-lg' : 'text-lg'}`}>
          Channels & Categories
        </h3>
        
        {hasPermission('manage_channels') && (
          <div className="flex space-x-2">
            <button
              onClick={() => setShowCategoryForm(true)}
              className={`px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors ${
                isMobile ? 'text-sm' : 'text-sm'
              }`}
            >
              + Category
            </button>
            <button
              onClick={() => setShowChannelForm(true)}
              className={`px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors ${
                isMobile ? 'text-sm' : 'text-sm'
              }`}
            >
              + Channel
            </button>
          </div>
        )}
      </div>

      {!hasPermission('manage_channels') && (
        <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
          <p className={`text-yellow-300 ${isMobile ? 'text-sm' : 'text-sm'}`}>
            You don't have permission to manage channels
          </p>
        </div>
      )}

      <div className="space-y-4">
        {organizedChannels.map((group) => (
          <div key={group.category.id} className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-gray-750 rounded-lg border border-gray-600">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span className={`font-medium text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
                  {group.category.name}
                </span>
                <span className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  ({group.channels.length})
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSelectedCategoryId(group.category.id)
                    setShowChannelForm(true)
                  }}
                  className="p-1 text-gray-400 hover:text-green-400 transition-colors"
                  title="Add channel to category"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                
                {hasPermission('manage_channels') && (
                  <button
                    onClick={() => setEditingCategory(group.category)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="ml-4 space-y-1">
              {group.channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-2 bg-gray-700 rounded-lg border border-gray-600"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-400">
                      {channel.type === 'text' ? '#' : '🔊'}
                    </span>
                    <div>
                      <span className={`text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
                        {channel.name}
                      </span>
                      {channel.description && (
                        <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                          {channel.description}
                        </p>
                      )}
                    </div>
                    {channel.permissions.length > 0 && (
                      <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>

                  {hasPermission('manage_channels') && (
                    <button
                      onClick={() => setEditingChannel(channel)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {uncategorizedChannels.length > 0 && (
          <div className="space-y-2">
            <h4 className={`font-medium text-gray-300 ${isMobile ? 'text-sm' : 'text-base'}`}>
              Uncategorized Channels
            </h4>
            <div className="space-y-1">
              {uncategorizedChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-2 bg-gray-700 rounded-lg border border-gray-600"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-400">
                      {channel.type === 'text' ? '#' : '🔊'}
                    </span>
                    <span className={`text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
                      {channel.name}
                    </span>
                  </div>

                  {hasPermission('manage_channels') && (
                    <button
                      onClick={() => setEditingChannel(channel)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {organizedChannels.length === 0 && uncategorizedChannels.length === 0 && (
        <div className="text-center py-8">
          <p className={`text-gray-400 ${isMobile ? 'text-sm' : 'text-base'}`}>
            No channels found. Create your first channel or category!
          </p>
        </div>
      )}
    </div>
  )
}