/**
 * Syntera Embeddable Widget
 * 
 * Auto-initializes when script is loaded on a webpage.
 * Usage:
 * <script src="https://cdn.syntera.com/widget.js"
 *         data-agent-id="agent-123"
 *         data-api-key="key-abc"
 *         data-api-url="https://api.syntera.com"></script>
 */

import { SynteraWidget } from './widget'
import './styles.css'

// Auto-initialize when script loads
(function() {
  // Get the current script element
  const script = document.currentScript as HTMLScriptElement | null
  
  if (!script) {
    console.error('[Syntera] Failed to find script element')
    return
  }

  // Extract configuration from data attributes
  const agentId = script.getAttribute('data-agent-id')
  const apiKey = script.getAttribute('data-api-key')
  const apiUrl = script.getAttribute('data-api-url') || 'https://api.syntera.com'
  const position = script.getAttribute('data-position') || 'bottom-right' // bottom-right, bottom-left, etc.
  const theme = script.getAttribute('data-theme') || 'light' // light, dark

  if (!agentId) {
    console.error('[Syntera] data-agent-id is required')
    return
  }

  if (!apiKey) {
    console.error('[Syntera] data-api-key is required')
    return
  }

  // Initialize widget
  const widget = new SynteraWidget({
    agentId,
    apiKey,
    apiUrl,
    position: position as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left',
    theme: theme as 'light' | 'dark',
  })

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      widget.init()
    })
  } else {
    widget.init()
  }

  // Expose widget globally for advanced usage
  ;(window as any).SynteraWidget = SynteraWidget
  ;(window as any).synteraWidget = widget
})()

