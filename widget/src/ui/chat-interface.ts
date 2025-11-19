/**
 * Chat Interface UI Component
 * Creates and manages the chat widget UI
 */

import { AvatarPlayer } from './avatar-player'
import type { Agent, Message, CallConfig } from '../types'

export interface ChatInterfaceConfig {
  agent: Agent
  theme: 'light' | 'dark'
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  onSendMessage: (content: string) => Promise<void>
  onStartCall: (type: 'voice' | 'video') => Promise<void>
  onClose: () => void
}

export class ChatInterface {
  private config: ChatInterfaceConfig
  private container: HTMLDivElement | null = null
  private button: HTMLButtonElement | null = null
  private window: HTMLDivElement | null = null
  private messagesContainer: HTMLDivElement | null = null
  private input: HTMLInputElement | null = null
  private isOpen = false
  public avatarPlayer: AvatarPlayer | null = null
  private isInCall = false

  constructor(config: ChatInterfaceConfig) {
    this.config = config
  }

  /**
   * Initialize the chat interface
   */
  init(): void {
    this.createFloatingButton()
    this.createChatWindow()
    this.attachStyles()
    this.showInitialAvatar()
  }

  /**
   * Create floating button
   */
  private createFloatingButton(): void {
    this.button = document.createElement('button')
    this.button.className = 'syntera-button'
    this.button.setAttribute('aria-label', 'Open chat')
    
    // Add agent avatar or default icon
    const avatarUrl = this.config.agent.avatar_url || this.generateAvatarUrl(this.config.agent.id)
    this.button.innerHTML = `
      <img src="${avatarUrl}" alt="${this.config.agent.name}" class="syntera-button-avatar" />
    `

    this.button.addEventListener('click', () => {
      this.toggle()
    })

    // Position button
    const position = this.getPositionStyles(this.config.position)
    Object.assign(this.button.style, {
      position: 'fixed',
      ...position,
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      border: 'none',
      backgroundColor: '#3b82f6',
      color: 'white',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: '999998',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.2s',
    })

    this.button.addEventListener('mouseenter', () => {
      if (this.button) {
        this.button.style.transform = 'scale(1.1)'
      }
    })

    this.button.addEventListener('mouseleave', () => {
      if (this.button) {
        this.button.style.transform = 'scale(1)'
      }
    })

    document.body.appendChild(this.button)
  }

  /**
   * Create chat window
   */
  private createChatWindow(): void {
    this.window = document.createElement('div')
    this.window.className = 'syntera-window'
    this.window.style.cssText = `
      position: fixed;
      ${this.getPositionStyles(this.config.position).bottom ? `bottom: 90px;` : `top: 90px;`}
      ${this.getPositionStyles(this.config.position).right ? `right: 20px;` : `left: 20px;`}
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 120px);
      background: ${this.config.theme === 'dark' ? '#1a1a1a' : '#ffffff'};
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      display: none;
      flex-direction: column;
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
    `

    // Header
    const header = this.createHeader()
    this.window.appendChild(header)

    // Messages area
    this.messagesContainer = document.createElement('div')
    this.messagesContainer.className = 'syntera-messages'
    this.messagesContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `
    this.window.appendChild(this.messagesContainer)

    // Input area
    const inputArea = this.createInputArea()
    this.window.appendChild(inputArea)

    document.body.appendChild(this.window)
  }

  /**
   * Create header
   */
  private createHeader(): HTMLDivElement {
    const header = document.createElement('div')
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid ${this.config.theme === 'dark' ? '#333' : '#e5e5e5'};
      display: flex;
      align-items: center;
      gap: 12px;
    `

    const avatarUrl = this.config.agent.avatar_url || this.generateAvatarUrl(this.config.agent.id)
    header.innerHTML = `
      <img src="${avatarUrl}" alt="${this.config.agent.name}" style="width: 40px; height: 40px; border-radius: 50%;" />
      <div style="flex: 1;">
        <div style="font-weight: 600; color: ${this.config.theme === 'dark' ? '#fff' : '#000'};">
          ${this.config.agent.name}
        </div>
        <div style="font-size: 12px; color: ${this.config.theme === 'dark' ? '#999' : '#666'};">
          Tap to start voice/video chat
        </div>
      </div>
      <button class="syntera-close" style="background: none; border: none; cursor: pointer; padding: 4px; color: ${this.config.theme === 'dark' ? '#999' : '#666'};">
        ✕
      </button>
    `

    const closeBtn = header.querySelector('.syntera-close')
    closeBtn?.addEventListener('click', () => {
      this.close()
    })

    return header
  }

  /**
   * Create input area
   */
  private createInputArea(): HTMLDivElement {
    const inputArea = document.createElement('div')
    inputArea.style.cssText = `
      padding: 16px;
      border-top: 1px solid ${this.config.theme === 'dark' ? '#333' : '#e5e5e5'};
      display: flex;
      gap: 8px;
      align-items: center;
    `

    // Voice/Video button
    const voiceBtn = document.createElement('button')
    voiceBtn.innerHTML = '🎤'
    voiceBtn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 20px;
      padding: 8px;
    `
    voiceBtn.addEventListener('click', () => {
      this.config.onStartCall('voice')
    })

    // Text input
    this.input = document.createElement('input')
    this.input.type = 'text'
    this.input.placeholder = 'Type a message...'
    this.input.style.cssText = `
      flex: 1;
      padding: 10px 12px;
      border: 1px solid ${this.config.theme === 'dark' ? '#333' : '#e5e5e5'};
      border-radius: 8px;
      background: ${this.config.theme === 'dark' ? '#2a2a2a' : '#fff'};
      color: ${this.config.theme === 'dark' ? '#fff' : '#000'};
      font-size: 14px;
    `

    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && this.input?.value.trim()) {
        this.sendMessage()
      }
    })

    // Send button
    const sendBtn = document.createElement('button')
    sendBtn.innerHTML = '➤'
    sendBtn.style.cssText = `
      background: #3b82f6;
      border: none;
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
    `
    sendBtn.addEventListener('click', () => {
      if (this.input?.value.trim()) {
        this.sendMessage()
      }
    })

    inputArea.appendChild(voiceBtn)
    inputArea.appendChild(this.input)
    inputArea.appendChild(sendBtn)

    return inputArea
  }

  /**
   * Send message
   */
  private async sendMessage(): Promise<void> {
    if (!this.input?.value.trim()) return

    const content = this.input.value.trim()
    this.input.value = ''

    // Add user message to UI immediately
    this.addMessage({
      id: `temp-${Date.now()}`,
      conversation_id: '',
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    })

    // Send to API
    await this.config.onSendMessage(content)
  }

  /**
   * Add message to UI
   */
  addMessage(message: Message): void {
    if (!this.messagesContainer) return

    // During calls, add messages but keep them below the avatar
    // The avatar should stay at the top of the messages container

    const messageEl = document.createElement('div')
    messageEl.className = `syntera-message syntera-message-${message.role}`
    
    const isUser = message.role === 'user'
    messageEl.style.cssText = `
      display: flex;
      gap: 8px;
      align-self: ${isUser ? 'flex-end' : 'flex-start'};
      max-width: 80%;
      flex-direction: ${isUser ? 'row-reverse' : 'row'};
    `

    // Avatar (for agent messages)
    if (!isUser) {
      const avatarUrl = this.config.agent.avatar_url || this.generateAvatarUrl(this.config.agent.id)
      const avatar = document.createElement('img')
      avatar.src = avatarUrl
      avatar.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        flex-shrink: 0;
      `
      messageEl.appendChild(avatar)
    }

    // Message content
    const content = document.createElement('div')
    content.style.cssText = `
      padding: 10px 14px;
      border-radius: 12px;
      background: ${isUser 
        ? '#3b82f6' 
        : (this.config.theme === 'dark' ? '#2a2a2a' : '#f3f4f6')};
      color: ${isUser || this.config.theme === 'dark' ? '#fff' : '#000'};
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    `
    content.textContent = message.content
    messageEl.appendChild(content)

    this.messagesContainer.appendChild(messageEl)
    this.scrollToBottom()
  }

  /**
   * Show initial avatar (static image)
   */
  private showInitialAvatar(): void {
    if (!this.messagesContainer) return

    // Don't show if already in call (video avatar will be shown)
    if (this.isInCall) return

    // Check if avatar already exists
    if (this.messagesContainer.querySelector('#syntera-initial-avatar')) {
      return
    }

    // Create avatar container
    const avatarContainer = document.createElement('div')
    avatarContainer.className = 'syntera-avatar-container'
    avatarContainer.id = 'syntera-initial-avatar'
    avatarContainer.style.cssText = `
      width: 100%;
      aspect-ratio: 16/9;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      overflow: hidden;
      margin: 12px 0;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    `

    const avatarUrl = this.config.agent.avatar_url || this.generateAvatarUrl(this.config.agent.id)
    const avatarImg = document.createElement('img')
    avatarImg.src = avatarUrl
    avatarImg.style.cssText = `
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `
    avatarImg.alt = this.config.agent.name

    avatarContainer.appendChild(avatarImg)
    this.messagesContainer.appendChild(avatarContainer)
  }

  /**
   * Start call with avatar
   */
  async startCall(config: CallConfig): Promise<void> {
    if (!this.window || !this.messagesContainer) return

    this.isInCall = true

    // DON'T remove initial avatar yet - keep it visible until video track arrives
    // The avatar player will remove it when a video track is received

    // Create avatar player
    this.avatarPlayer = new AvatarPlayer({
      container: this.messagesContainer,
      conversationId: config.conversationId,
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
    })

    // Don't call start() - wait for video track from LiveKit
    // The video track will be handled by startWithTrack() when received
  }

  /**
   * Set typing indicator
   */
  setTyping(isTyping: boolean): void {
    // TODO: Implement typing indicator
  }

  /**
   * Show error message
   */
  showError(message: string): void {
    // TODO: Show error in UI
    console.error('[Syntera]', message)
  }

  /**
   * Toggle chat window
   */
  toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  /**
   * Open chat window
   */
  open(): void {
    if (this.window) {
      this.window.style.display = 'flex'
      this.isOpen = true
      if (this.input) {
        this.input.focus()
      }
    }
  }

  /**
   * Close chat window
   */
  close(): void {
    if (this.window) {
      this.window.style.display = 'none'
      this.isOpen = false
    }
    if (this.config.onClose) {
      this.config.onClose()
    }
  }

  /**
   * Get position styles
   */
  private getPositionStyles(position: string): Record<string, string> {
    const styles: Record<string, string> = {}
    
    if (position.includes('bottom')) {
      styles.bottom = '20px'
    } else {
      styles.top = '20px'
    }
    
    if (position.includes('right')) {
      styles.right = '20px'
    } else {
      styles.left = '20px'
    }
    
    return styles
  }

  /**
   * Generate avatar URL (using DiceBear or similar)
   */
  private generateAvatarUrl(seed: string): string {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&size=128`
  }

  /**
   * Scroll to bottom
   */
  private scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
    }
  }

  /**
   * Attach styles
   */
  private attachStyles(): void {
    // Styles are mostly inline for simplicity
    // Can be extracted to CSS file if needed
  }
}

