import { useState, useEffect, useRef } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import {
  Zap,
  Image as ImageIcon,
  Download,
  Loader2,
  Settings,
  RefreshCw,
  Maximize2,
  FolderOpen,
  X,
  Sparkles,
  Save,
  Github,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Globe
} from 'lucide-react'
import './App.css'
import { useTranslation } from './LanguageContext.jsx'

function App() {
  const { t, language, toggleLanguage } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [modelPath, setModelPath] = useState('')
  const [settings, setSettings] = useState({
    steps: 8,
    guidance_scale: 0.0,
    width: 1024,
    height: 1024,
    seed: -1
  })
  const [modelStatus, setModelStatus] = useState({
    status: 'ready', // ready, loading, success, error
    message: t('modelStatus.ready'),
    device: null
  })
  const ws = useRef(null)

  // Fetch initial settings
  useEffect(() => {
    fetch('http://localhost:8000/settings')
      .then(res => res.json())
      .then(data => {
        if (data.cache_dir) setModelPath(data.cache_dir)
      })
      .catch(err => console.error("Failed to fetch settings", err))
  }, [])

  // WebSocket connection
  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:8000/ws')
    
    ws.current.onopen = () => {
      console.log('WebSocket connected')
    }
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'notification') {
        if (data.notification_type === 'info') {
          setModelStatus({
            status: 'loading',
            message: data.message,
            device: null
          })
        } else if (data.notification_type === 'success') {
          const deviceMatch = data.message.match(/设备: (\w+)/)
          setModelStatus({
            status: 'success',
            message: t('modelStatus.success'),
            device: deviceMatch ? deviceMatch[1] : null
          })
        } else if (data.notification_type === 'error') {
          setModelStatus({
            status: 'error',
            message: data.message,
            device: null
          })
        }
      }
    }
    
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    ws.current.onclose = () => {
      console.log('WebSocket disconnected')
    }
    
    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [])

  const generate = async () => {
    if (!prompt) return
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...settings })
      })
      if (!res.ok) {
        throw new Error('Generation failed')
      }
      const data = await res.json()
      if (data.image) {
        setImage(data.image)
      }
    } catch (e) {
      console.error(e)
      showToast(t('prompt.generatingError', 'Error generating image. Check backend console.'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      const res = await fetch('http://localhost:8000/settings/model-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cache_dir: modelPath })
      })
      if (res.ok) {
        setShowSettings(false)
        showToast(t('settings.saveSuccess'), 'success')
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (e) {
      showToast(t('settings.saveError') + e.message, 'error')
    }
  }

  // Toast notification functions
  const showToast = (message, type = 'info') => {
    const options = {
      style: {
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px',
        fontSize: '14px'
      },
      iconTheme: {
        primary: 'white',
        secondary: 'var(--bg-secondary)'
      }
    }

    switch (type) {
      case 'success':
        return toast.success(message, {
          ...options,
          icon: <CheckCircle size={20} color="#22c55e" />
        })
      case 'error':
        return toast.error(message, {
          ...options,
          icon: <AlertCircle size={20} color="#ef4444" />
        })
      case 'warning':
        return toast(message, {
          ...options,
          icon: <AlertTriangle size={20} color="#eab308" />
        })
      case 'info':
      default:
        return toast(message, {
          ...options,
          icon: <Info size={20} color="#3b82f6" />
        })
    }
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          success: {
            duration: 3000
          },
          error: {
            duration: 5000
          }
        }}
      />
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)'
      }}>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: '500px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-tertiary)'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} /> {t('settings.title')}
              </h2>
              <button onClick={() => setShowSettings(false)} style={{
                padding: '8px',
                borderRadius: '9999px',
                transition: 'background 0.2s'
              }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {t('settings.modelCacheDirectory')}
                </label>
                <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <FolderOpen style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)'
                    }} size={16} />
                    <input
                      type="text"
                      value={modelPath}
                      onChange={(e) => setModelPath(e.target.value)}
                      placeholder={t('settings.modelCachePlaceholder')}
                      style={{ width: '100%', paddingLeft: '40px' }}
                    />
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('settings.modelCacheHelp')}
                </p>
              </div>
            </div>
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--bg-tertiary)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)'
                }}
              >
                {t('settings.cancel')}
              </button>
              <button
                onClick={saveSettings}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  backgroundColor: 'white',
                  color: 'black',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Save size={16} /> {t('settings.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div style={{
        width: '360px',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-secondary)',
        flexShrink: 0
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: 'white',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Zap style={{ width: '20px', height: '20px', color: 'black' }} fill="black" />
              </div>
              <div>
                <h1 style={{ fontWeight: 700, fontSize: '18px', lineHeight: 1 }}>{t('app.title')}</h1>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px'
                }}>{t('app.subtitle')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={toggleLanguage}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  minWidth: '32px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                title={language === 'zh' ? 'Switch to English' : '切换到中文'}
              >
                {language === 'zh' ? '中' : 'EN'}
              </button>
              <a
                href="https://github.com/Aaryan-Kapoor/z-image-turbo"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                title={t('github')}
              >
                <Github size={18} />
              </a>
              <button
                onClick={() => setShowSettings(true)}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                title={t('settingsBtn')}
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <Sparkles size={14} />
              <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {t('parameters.title')}
              </h2>
            </div>

            {/* Inference Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>{t('parameters.inferenceSteps')}</label>
                <span style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)'
                }}>{settings.steps}</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={settings.steps}
                onChange={e => setSettings({ ...settings, steps: parseInt(e.target.value) })}
              />
            </div>

            {/* Guidance Scale */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>{t('parameters.guidanceScale')}</label>
                <span style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)'
                }}>{settings.guidance_scale.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={settings.guidance_scale}
                onChange={e => setSettings({ ...settings, guidance_scale: parseFloat(e.target.value) })}
              />
            </div>

            {/* Dimensions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>{t('parameters.dimensions')}</label>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {settings.width} x {settings.height}
                </span>
              </div>

              {/* Aspect Ratio Presets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {[
                  { label: t('aspectRatios.square'), ratio: '1:1', w: 1024, h: 1024 },
                  { label: t('aspectRatios.portrait'), ratio: '3:4', w: 896, h: 1152 },
                  { label: t('aspectRatios.landscape'), ratio: '4:3', w: 1152, h: 896 },
                  { label: t('aspectRatios.wide'), ratio: '16:9', w: 1344, h: 768 }
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => setSettings({ ...settings, width: preset.w, height: preset.h })}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 4px',
                      backgroundColor: (settings.width === preset.w && settings.height === preset.h) ? 'white' : 'var(--bg-tertiary)',
                      color: (settings.width === preset.w && settings.height === preset.h) ? 'black' : 'var(--text-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 700 }}>{preset.ratio}</span>
                    <span style={{ fontSize: '9px', opacity: 0.7 }}>{preset.label}</span>
                  </button>
                ))}
              </div>

              {/* Resolution Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <select
                  value={[
                    "256x256", "512x288", "640x352",
                    "512x512", "768x768", "1024x1024",
                    "848x480", "1280x720", "1920x1088"
                  ].includes(`${settings.width}x${settings.height}`) ? `${settings.width}x${settings.height}` : "custom"}
                  onChange={(e) => {
                    if (e.target.value !== "custom") {
                      const [w, h] = e.target.value.split('x').map(Number);
                      setSettings({ ...settings, width: w, height: h });
                    }
                  }}
                  style={{
                    fontSize: '12px',
                    padding: '8px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'white',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  <option value="custom" disabled>{t('resolutions.select')}</option>
                  <optgroup label={t('resolutions.tiny')}>
                    <option value="256x256">{t('resolutions.tiny256')}</option>
                    <option value="512x288">{t('resolutions.tiny288')}</option>
                    <option value="640x352">{t('resolutions.tiny360')}</option>
                  </optgroup>
                  <optgroup label={t('resolutions.standard')}>
                    <option value="512x512">{t('resolutions.sd512')}</option>
                    <option value="768x768">{t('resolutions.sd768')}</option>
                    <option value="1024x1024">{t('resolutions.xl1024')}</option>
                  </optgroup>
                  <optgroup label={t('resolutions.widescreen')}>
                    <option value="848x480">{t('resolutions.wide480')}</option>
                    <option value="1280x720">{t('resolutions.wide720')}</option>
                    <option value="1920x1088">{t('resolutions.wide1080')}</option>
                  </optgroup>
                </select>
              </div>

              {/* Sliders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Width Slider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('width')}</span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{settings.width}{t('px')}</span>
                  </div>
                  <input
                    type="range"
                    min="256"
                    max="2048"
                    step="16"
                    value={settings.width}
                    onChange={e => setSettings({ ...settings, width: parseInt(e.target.value) })}
                  />
                </div>

                {/* Height Slider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('height')}</span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{settings.height}{t('px')}</span>
                  </div>
                  <input
                    type="range"
                    min="256"
                    max="2048"
                    step="16"
                    value={settings.height}
                    onChange={e => setSettings({ ...settings, height: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Seed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>{t('parameters.seed')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  placeholder={t('parameters.randomSeed')}
                  value={settings.seed}
                  onChange={e => setSettings({ ...settings, seed: parseInt(e.target.value) })}
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '14px', width: '100%' }}
                />
                <button
                  onClick={() => setSettings({ ...settings, seed: -1 })}
                  style={{
                    padding: '0 12px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: 500,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                  title={t('parameters.resetRandom')}
                >
                  <span style={{ color: 'white' }}>RND</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Model Status */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: modelStatus.status === 'loading' ? '#eab308' :
                              modelStatus.status === 'success' ? '#22c55e' :
                              modelStatus.status === 'error' ? '#ef4444' : '#22c55e',
              boxShadow: modelStatus.status === 'loading' ? '0 0 8px rgba(234, 179, 8, 0.5)' :
                        modelStatus.status === 'success' ? '0 0 8px rgba(34, 197, 94, 0.5)' :
                        modelStatus.status === 'error' ? '0 0 8px rgba(239, 68, 68, 0.5)' :
                        '0 0 8px rgba(34, 197, 94, 0.5)',
              animation: modelStatus.status === 'loading' ? 'pulse 1.5s infinite' : 'none'
            }}></div>
            <span style={{
              color: modelStatus.status === 'error' ? '#ef4444' : 'var(--text-secondary)'
            }}>
              {modelStatus.message}
            </span>
            {modelStatus.device && (
              <span style={{
                color: 'var(--text-muted)',
                fontFamily: 'monospace'
              }}>
                ({modelStatus.device})
              </span>
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: loading ? '#eab308' : '#22c55e',
              boxShadow: loading ? '0 0 8px rgba(234, 179, 8, 0.5)' : '0 0 8px rgba(34, 197, 94, 0.5)'
            }}></div>
            <span>{loading ? t('systemStatus.generating') : t('systemStatus.systemReady')}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-primary)'
      }}>

        {/* Top Bar */}
        <div style={{
          height: '64px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            {t('app.workspace')} / <span style={{ color: 'white' }}>{t('app.newGeneration')}</span>
          </div>
        </div>

        {/* Image Display Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: 'var(--bg-primary)'
        }}>
          {image ? (
            <div style={{
              position: 'relative',
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)'
            }} className="animate-fade-in image-container">
              <img
                src={image}
                alt="Generated"
                style={{
                  maxHeight: 'calc(100vh - 300px)',
                  objectFit: 'contain',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  display: 'block'
                }}
              />

              <div className="image-overlay" style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                opacity: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                backdropFilter: 'blur(2px)',
                transition: 'opacity 0.2s'
              }}>
                <button
                  style={{
                    padding: '12px',
                    backgroundColor: 'white',
                    color: 'black',
                    borderRadius: '50%',
                    boxShadow: 'var(--shadow-lg)',
                    transition: 'transform 0.2s'
                  }}
                  title={t('image.download')}
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = image
                    link.download = `z-image-${Date.now()}.png`
                    link.click()
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Download size={24} />
                </button>
                <button
                  style={{
                    padding: '12px',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '50%',
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s'
                  }}
                  title={t('image.fullscreen')}
                  onClick={() => window.open(image, '_blank')}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
                    e.currentTarget.style.transform = 'scale(1.1)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  <Maximize2 size={24} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              color: 'var(--text-secondary)',
              opacity: 0.5,
              userSelect: 'none'
            }}>
              <div style={{
                width: '192px',
                height: '192px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--bg-secondary)',
                border: '2px dashed var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ImageIcon size={64} strokeWidth={1} />
              </div>
              <p style={{ fontSize: '18px', fontWeight: 300, letterSpacing: '0.5px' }}>
                {t('image.placeholder')}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div style={{
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '24px'
        }}>
          <div style={{ maxWidth: '1024px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <textarea
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  paddingRight: image ? '180px' : '140px',
                  resize: 'none',
                  height: '128px',
                  fontSize: '16px',
                  lineHeight: 1.5,
                  transition: 'all 0.2s'
                }}
                placeholder={t('prompt.placeholder')}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--border-light)'
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                display: 'flex',
                gap: '8px'
              }}>
                {image && (
                  <button
                    onClick={generate}
                    disabled={loading || !prompt}
                    style={{
                      height: '40px',
                      padding: '0 16px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      color: 'white',
                      fontWeight: 500,
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--border)')}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    title={t('image.regenerate')}
                  >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  </button>
                )}
                <button
                  onClick={generate}
                  disabled={loading || !prompt}
                  style={{
                    height: '40px',
                    padding: '0 24px',
                    backgroundColor: 'white',
                    color: 'black',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)'
                  }}
                  onMouseEnter={e => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#e5e5e5'
                      e.currentTarget.style.boxShadow = '0 0 25px rgba(255, 255, 255, 0.2)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} fill="black" />}
                  <span>{loading ? t('prompt.generating') : t('prompt.generate')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        .image-container:hover .image-overlay {
          opacity: 1 !important;
        }
        
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
      </div>
    </>
  )
}

export default App
