import React, { useState, useEffect } from 'react';
import { 
  translations 
} from './utils/i18n.js';
import { 
  Bot, 
  Wifi, 
  WifiOff, 
  Settings, 
  Users, 
  Megaphone, 
  CreditCard, 
  Languages, 
  LogOut, 
  User, 
  Plus, 
  Search, 
  Send,
  MessageSquare,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Loader,
  Play
} from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState('sw');
  const t = translations[lang];

  // Auth States
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // WhatsApp connection state
  const [wsStatus, setWsStatus] = useState({ status: 'disconnected', qr_code: null });
  const [isConnecting, setIsConnecting] = useState(false);

  // Stats for dashboard
  const [stats, setStats] = useState({
    activeAgents: 0,
    messagesProcessed: 0,
    totalContacts: 0,
    campaignsSent: 0
  });

  // AI Configuration State
  const [aiConfig, setAiConfig] = useState({
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    api_key: '',
    system_prompt: '',
    temperature: 0.7,
    enabled: 0
  });
  const [aiSaveMsg, setAiSaveMsg] = useState('');

  // CRM States
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMsgText, setNewMsgText] = useState('');
  const [contactForm, setContactForm] = useState({ phone_number: '', name: '', tags: '', notes: '' });
  const [showAddContact, setShowAddContact] = useState(false);

  // Campaign States
  const [campaigns, setCampaigns] = useState([]);
  const [campForm, setCampForm] = useState({ name: '', text: '', target_tags: '' });
  const [campMsg, setCampMsg] = useState('');

  // Billing States
  const [payPhone, setPayPhone] = useState('');
  const [payAmount, setPayAmount] = useState(10000);
  const [payProvider, setPayProvider] = useState('mpesa');
  const [payStatus, setPayStatus] = useState('');
  const [payRef, setPayRef] = useState('');

  // Fetch current user details on mount/token change
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchUser();
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  // Periodic polling for status when logged in
  useEffect(() => {
    if (!user) return;

    fetchSessionStatus();
    fetchStats();

    const interval = setInterval(() => {
      fetchSessionStatus();
      fetchStats();
      if (payRef) {
        checkPaymentStatus(payRef);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, payRef]);

  // Tab change reactions
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'aiConfig') fetchAIConfig();
    if (activeTab === 'crm') fetchContacts();
    if (activeTab === 'campaigns') fetchCampaigns();
  }, [activeTab, user]);

  // Chat message polling
  useEffect(() => {
    if (!user || !selectedContact) return;

    fetchChatMessages(selectedContact.id);
    const interval = setInterval(() => {
      fetchChatMessages(selectedContact.id);
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedContact, user]);

  const apiFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  };

  const fetchUser = async () => {
    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data);
    } catch (err) {
      setToken('');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: authForm.email, password: authForm.password })
        });
        setToken(data.token);
      } else {
        const data = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(authForm)
        });
        setToken(data.token);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
  };

  // WhatsApp connection helpers
  const fetchSessionStatus = async () => {
    try {
      const data = await apiFetch('/api/session/status');
      setWsStatus(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConnectWhatsapp = async () => {
    setIsConnecting(true);
    try {
      await apiFetch('/api/session/connect', { method: 'POST' });
      await fetchSessionStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWhatsapp = async () => {
    try {
      await apiFetch('/api/session/disconnect', { method: 'POST' });
      await fetchSessionStatus();
    } catch (err) {
      console.error(err);
    }
  };

  // Stats loader
  const fetchStats = async () => {
    try {
      const activeAgents = aiConfig.enabled ? 1 : 0;
      const cList = await apiFetch('/api/crm/contacts');
      
      let msgCount = 0;
      for (const c of cList) {
        const msgs = await apiFetch(`/api/crm/messages/${c.id}`);
        msgCount += msgs.length;
      }

      const campList = await apiFetch('/api/campaigns');

      setStats({
        activeAgents,
        messagesProcessed: msgCount,
        totalContacts: cList.length,
        campaignsSent: campList.length
      });
    } catch (err) {
      console.error(err);
    }
  };

  // AI Config helpers
  const fetchAIConfig = async () => {
    try {
      const data = await apiFetch('/api/config/ai');
      setAiConfig({ ...data, api_key: '' }); // Clear api_key for safety
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAIConfig = async (e) => {
    e.preventDefault();
    setAiSaveMsg('');
    try {
      await apiFetch('/api/config/ai', {
        method: 'POST',
        body: JSON.stringify(aiConfig)
      });
      setAiSaveMsg(t.savedSuccess);
      setTimeout(() => setAiSaveMsg(''), 4000);
    } catch (err) {
      setAiSaveMsg('Error: ' + err.message);
    }
  };

  // CRM Contacts helpers
  const fetchContacts = async () => {
    try {
      const data = await apiFetch('/api/crm/contacts');
      setContacts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddContactSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await apiFetch('/api/crm/contacts', {
        method: 'POST',
        body: JSON.stringify(contactForm)
      });
      setContacts([data, ...contacts]);
      setShowAddContact(false);
      setContactForm({ phone_number: '', name: '', tags: '', notes: '' });
    } catch (err) {
      alert(err.message);
    }
  };

  const fetchChatMessages = async (contactId) => {
    try {
      const data = await apiFetch(`/api/crm/messages/${contactId}`);
      setChatMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendManualMsg = async (e) => {
    e.preventDefault();
    if (!newMsgText.trim() || !selectedContact) return;

    try {
      await apiFetch('/api/crm/messages/send', {
        method: 'POST',
        body: JSON.stringify({ contact_id: selectedContact.id, text: newMsgText })
      });
      setNewMsgText('');
      fetchChatMessages(selectedContact.id);
    } catch (err) {
      alert(err.message);
    }
  };

  // Broadcasts helpers
  const fetchCampaigns = async () => {
    try {
      const data = await apiFetch('/api/campaigns');
      setCampaigns(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLaunchCampaign = async (e) => {
    e.preventDefault();
    setCampMsg('');
    try {
      const data = await apiFetch('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(campForm)
      });
      setCampMsg(data.message);
      setCampForm({ name: '', text: '', target_tags: '' });
      fetchCampaigns();
    } catch (err) {
      setCampMsg('Error: ' + err.message);
    }
  };

  // Payments helpers
  const handlePayment = async (e) => {
    e.preventDefault();
    setPayStatus('processing');
    try {
      const data = await apiFetch('/api/payments/subscribe', {
        method: 'POST',
        body: JSON.stringify({ phone_number: payPhone, amount: payAmount, provider: payProvider })
      });
      setPayRef(data.reference);
    } catch (err) {
      setPayStatus('error');
      alert(err.message);
    }
  };

  const checkPaymentStatus = async (reference) => {
    try {
      const data = await apiFetch(`/api/payments/status/${reference}`);
      if (data.status === 'success') {
        setPayStatus('success');
        setPayRef('');
        fetchUser();
      } else if (data.status === 'failed') {
        setPayStatus('failed');
        setPayRef('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered contacts list
  const filteredContacts = contacts.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone_number?.includes(searchQuery) ||
    c.tags?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Authentication View
  if (!user) {
    return (
      <div className="auth-container">
        <div className="language-badge" onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}>
          <Languages size={16} />
          <span>{lang === 'en' ? 'SW' : 'EN'}</span>
        </div>
        <div className="auth-card">
          <div className="brand-logo">
            <Bot size={48} className="glow-icon" />
            <h1>{t.brand}</h1>
            <p>{t.subtitle}</p>
          </div>

          <form onSubmit={handleAuthSubmit}>
            <h2>{authMode === 'login' ? t.login : t.register}</h2>
            {authError && <div className="alert alert-danger">{authError}</div>}
            
            {authMode === 'register' && (
              <div className="form-group">
                <label>{t.fullName}</label>
                <input 
                  type="text" 
                  required 
                  value={authForm.name} 
                  onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                />
              </div>
            )}

            <div className="form-group">
              <label>{t.email}</label>
              <input 
                type="email" 
                required 
                value={authForm.email} 
                onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{t.password}</label>
              <input 
                type="password" 
                required 
                value={authForm.password} 
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              {authMode === 'login' ? t.signIn : t.signUp}
            </button>
          </form>

          <div className="auth-toggle">
            {authMode === 'login' ? (
              <p>{t.noAccount} <span onClick={() => setAuthMode('register')}>{t.signUp}</span></p>
            ) : (
              <p>{t.hasAccount} <span onClick={() => setAuthMode('login')}>{t.signIn}</span></p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard Interface
  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Bot size={32} className="glow-icon" />
          <div>
            <h3>{t.brand}</h3>
            <span>{t.subtitle}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Bot size={20} />
            <span>{t.dashboard}</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'whatsapp' ? 'active' : ''}`}
            onClick={() => setActiveTab('whatsapp')}
          >
            <Wifi size={20} />
            <span>{t.whatsappConnection}</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'aiConfig' ? 'active' : ''}`}
            onClick={() => setActiveTab('aiConfig')}
          >
            <Settings size={20} />
            <span>{t.aiConfig}</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'crm' ? 'active' : ''}`}
            onClick={() => setActiveTab('crm')}
          >
            <Users size={20} />
            <span>{t.crm}</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
          >
            <Megaphone size={20} />
            <span>{t.campaigns}</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <CreditCard size={20} />
            <span>{t.billing}</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <User size={18} />
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-plan">{user.plan.toUpperCase()}</span>
            </div>
          </div>
          
          <div className="footer-actions">
            <button className="btn-icon" onClick={() => setLang(lang === 'en' ? 'sw' : 'en')} title="Toggle Language">
              <Languages size={18} />
            </button>
            <button className="btn-icon text-danger" onClick={handleLogout} title="Log Out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h1>{t.dashboard}</h1>
              <p>{t.tagline}</p>
            </div>

            <div className="grid grid-4">
              <div className="stats-card">
                <Sparkles size={24} className="card-icon text-primary" />
                <h3>{stats.activeAgents}</h3>
                <p>{t.activeAgents}</p>
              </div>

              <div className="stats-card">
                <MessageSquare size={24} className="card-icon text-success" />
                <h3>{stats.messagesProcessed}</h3>
                <p>{t.messagesProcessed}</p>
              </div>

              <div className="stats-card">
                <Users size={24} className="card-icon text-warning" />
                <h3>{stats.totalContacts}</h3>
                <p>{t.totalContacts}</p>
              </div>

              <div className="stats-card">
                <Megaphone size={24} className="card-icon text-danger" />
                <h3>{stats.campaignsSent}</h3>
                <p>{t.campaignsSent}</p>
              </div>
            </div>

            <div className="dashboard-sections grid grid-2">
              {/* Account Status Card */}
              <div className="content-card">
                <h2>{t.activePlan}</h2>
                <div className="plan-badge-large">{user.plan.toUpperCase()}</div>
                <div className="plan-expiry">
                  <span>{t.validUntil}:</span>
                  <strong>
                    {user.active_until 
                      ? new Date(user.active_until).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : t.unlimited}
                  </strong>
                </div>
                <button className="btn btn-primary" onClick={() => setActiveTab('billing')}>{t.upgradeNow}</button>
              </div>

              {/* Quick WhatsApp Status */}
              <div className="content-card">
                <h2>{t.connectionStatus}</h2>
                <div className={`status-badge ${wsStatus.status}`}>
                  {wsStatus.status === 'connected' ? <Wifi size={18} /> : <WifiOff size={18} />}
                  <span>{wsStatus.status === 'connected' ? t.connected : t.disconnected}</span>
                </div>
                {wsStatus.phone_number && <p className="phone-display">+{wsStatus.phone_number}</p>}
                <button className="btn btn-outline" onClick={() => setActiveTab('whatsapp')}>{t.whatsappConnection}</button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WHATSAPP CONNECTION */}
        {activeTab === 'whatsapp' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h1>{t.whatsappConnection}</h1>
              <p>Configure and activate the WhatsApp Web gateway.</p>
            </div>

            <div className="content-card center-card">
              <h2>{t.connectionStatus}: <span className={`text-${wsStatus.status === 'connected' ? 'success' : 'danger'}`}>{wsStatus.status === 'connected' ? t.connected : t.disconnected}</span></h2>

              {wsStatus.status === 'disconnected' && (
                <div className="action-box">
                  <button className="btn btn-primary" onClick={handleConnectWhatsapp} disabled={isConnecting}>
                    {isConnecting ? <Loader className="spin" size={18} /> : null}
                    {t.connectButton}
                  </button>
                </div>
              )}

              {wsStatus.status === 'qr' && wsStatus.qr_code && (
                <div className="qr-box">
                  <p className="instruction">{t.scanInstruction}</p>
                  <div className="qr-image-wrapper">
                    <img src={wsStatus.qr_code} alt="WhatsApp QR Code" />
                  </div>
                  <button className="btn btn-outline" onClick={handleDisconnectWhatsapp}>
                    {t.disconnectButton}
                  </button>
                </div>
              )}

              {wsStatus.status === 'connected' && (
                <div className="connected-box">
                  <CheckCircle size={64} className="text-success" />
                  {wsStatus.phone_number && <h3>+{wsStatus.phone_number}</h3>}
                  <button className="btn btn-danger" onClick={handleDisconnectWhatsapp}>
                    {t.disconnectButton}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AI CONFIGURATION */}
        {activeTab === 'aiConfig' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h1>{t.aiTitle}</h1>
              <p>Set custom system instructions and customize your client agent.</p>
            </div>

            <div className="content-card">
              <form onSubmit={handleSaveAIConfig}>
                {aiSaveMsg && (
                  <div className={`alert ${aiSaveMsg.startsWith('Error') ? 'alert-danger' : 'alert-success'}`}>
                    {aiSaveMsg}
                  </div>
                )}

                <div className="grid grid-2">
                  <div className="form-group">
                    <label>{t.aiProvider}</label>
                    <select 
                      value={aiConfig.provider}
                      onChange={e => setAiConfig({ ...aiConfig, provider: e.target.value })}
                    >
                      <option value="gemini">Gemini (Google)</option>
                      <option value="openai">OpenAI</option>
                      <option value="claude">Claude (Anthropic)</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{t.aiModel}</label>
                    <input 
                      type="text" 
                      value={aiConfig.model}
                      placeholder="e.g. gemini-1.5-flash, gpt-4o-mini"
                      onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t.apiKeyOverride}</label>
                  <input 
                    type="password" 
                    value={aiConfig.api_key}
                    placeholder="sk-..."
                    onChange={e => setAiConfig({ ...aiConfig, api_key: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>{t.systemPrompt}</label>
                  <textarea 
                    rows={6}
                    value={aiConfig.system_prompt}
                    onChange={e => setAiConfig({ ...aiConfig, system_prompt: e.target.value })}
                  />
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label>{t.temperature} ({aiConfig.temperature})</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="1.2" 
                      step="0.1"
                      value={aiConfig.temperature}
                      onChange={e => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="form-group checkbox-group">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox"
                        checked={aiConfig.enabled === 1}
                        onChange={e => setAiConfig({ ...aiConfig, enabled: e.target.checked ? 1 : 0 })}
                      />
                      <span className="slider"></span>
                    </label>
                    <span className="checkbox-label">{aiConfig.enabled === 1 ? t.enableAI : t.disableAI}</span>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary">{t.saveConfig}</button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: CRM CONTACTS */}
        {activeTab === 'crm' && (
          <div className="tab-pane crm-pane">
            <div className="pane-header">
              <h1>{t.crmTitle}</h1>
              <p>Store customers and handle conversational flows manually or dynamically.</p>
            </div>

            <div className="crm-layout">
              {/* Left Contacts List */}
              <div className="contacts-sidebar">
                <div className="search-bar-wrapper">
                  <Search size={18} />
                  <input 
                    type="text" 
                    placeholder={t.searchContacts} 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                <button className="btn btn-primary btn-block mb-3" onClick={() => setShowAddContact(true)}>
                  <Plus size={16} />
                  {t.addContact}
                </button>

                <div className="contacts-list">
                  {filteredContacts.map(c => (
                    <div 
                      key={c.id} 
                      className={`contact-item ${selectedContact?.id === c.id ? 'active' : ''}`}
                      onClick={() => setSelectedContact(c)}
                    >
                      <div className="contact-avatar">{c.name ? c.name[0].toUpperCase() : '#'}</div>
                      <div className="contact-details">
                        <h4>{c.name || 'Unknown'}</h4>
                        <span>+{c.phone_number}</span>
                        {c.tags && (
                          <div className="tags-row">
                            {c.tags.split(',').map(tag => (
                              <span key={tag} className="tag-pill">{tag.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Chat History or Add Contact modal placeholder */}
              <div className="chat-area">
                {showAddContact ? (
                  <div className="content-card add-contact-card">
                    <h2>{t.addContact}</h2>
                    <form onSubmit={handleAddContactSubmit}>
                      <div className="form-group">
                        <label>{t.phone} (Format: 255XXXXXXXXX)</label>
                        <input 
                          type="text" 
                          required 
                          value={contactForm.phone_number}
                          onChange={e => setContactForm({ ...contactForm, phone_number: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label>{t.name}</label>
                        <input 
                          type="text" 
                          value={contactForm.name}
                          onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label>{t.tags}</label>
                        <input 
                          type="text" 
                          placeholder="e.g. lead, premium, support"
                          value={contactForm.tags}
                          onChange={e => setContactForm({ ...contactForm, tags: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label>{t.notes}</label>
                        <textarea 
                          rows={3}
                          value={contactForm.notes}
                          onChange={e => setContactForm({ ...contactForm, notes: e.target.value })}
                        />
                      </div>

                      <div className="button-group">
                        <button type="submit" className="btn btn-primary">{t.saveContact}</button>
                        <button type="button" className="btn btn-outline" onClick={() => setShowAddContact(false)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                ) : selectedContact ? (
                  <div className="chat-window">
                    <div className="chat-header">
                      <h3>{selectedContact.name || 'Unknown'}</h3>
                      <span>+{selectedContact.phone_number}</span>
                    </div>

                    <div className="chat-messages-box">
                      {chatMessages.length === 0 ? (
                        <div className="empty-chat">No messages yet.</div>
                      ) : (
                        chatMessages.map(m => (
                          <div key={m.id} className={`message-row ${m.direction}`}>
                            <div className="message-bubble">
                              <span className="msg-sender-label">{m.direction === 'incoming' ? t.incoming : t.outgoing}</span>
                              <p>{m.text}</p>
                              <span className="msg-time">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleSendManualMsg} className="chat-input-bar">
                      <input 
                        type="text" 
                        placeholder={t.typeMessage}
                        value={newMsgText}
                        onChange={e => setNewMsgText(e.target.value)}
                      />
                      <button type="submit" className="btn btn-primary">
                        <Send size={18} />
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="empty-state">
                    <MessageSquare size={48} />
                    <p>Select a contact to view their chat history or start chatting manually.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CAMPAIGNS */}
        {activeTab === 'campaigns' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h1>{t.campaignTitle}</h1>
              <p>Schedule and dispatch bulk marketing/promotional notifications.</p>
            </div>

            <div className="grid grid-2">
              <div className="content-card">
                <h2>Launch Campaign</h2>
                <form onSubmit={handleLaunchCampaign}>
                  {campMsg && <div className="alert alert-info">{campMsg}</div>}

                  <div className="form-group">
                    <label>{t.campaignName}</label>
                    <input 
                      type="text" 
                      required 
                      value={campForm.name}
                      onChange={e => setCampForm({ ...campForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.targetTags}</label>
                    <input 
                      type="text" 
                      placeholder="e.g. lead (leave empty to send to all contacts)"
                      value={campForm.target_tags}
                      onChange={e => setCampForm({ ...campForm, target_tags: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.broadcastText}</label>
                    <textarea 
                      rows={5}
                      required
                      value={campForm.text}
                      onChange={e => setCampForm({ ...campForm, text: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary">
                    <Play size={16} />
                    {t.launchCampaign}
                  </button>
                </form>
              </div>

              <div className="content-card">
                <h2>Campaign Logs</h2>
                <div className="logs-list">
                  {campaigns.length === 0 ? (
                    <p>No campaigns executed yet.</p>
                  ) : (
                    campaigns.map(c => (
                      <div key={c.id} className="log-item">
                        <div className="log-header">
                          <h4>{c.name}</h4>
                          <span className={`badge badge-${c.status}`}>{t[c.status] || c.status}</span>
                        </div>
                        <p className="log-text">{c.text}</p>
                        <span className="log-time">{t.scheduledAt}: {new Date(c.created_at).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: BILLING & SaaS PRICING */}
        {activeTab === 'billing' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h1>{t.billingTitle}</h1>
              <p>Choose a plan and pay automatically with M-Pesa or Tigo Pesa push notifications.</p>
            </div>

            <div className="grid grid-3">
              {/* Free Plan */}
              <div className="pricing-card">
                <h3>{t.freePlan}</h3>
                <div className="price">0 {t.currency}<span>/ month</span></div>
                <ul>
                  <li>1 AI Agent Connection</li>
                  <li>Gemini 1.5 Flash Support</li>
                  <li>Basic CRM & Chat Logs</li>
                </ul>
                <button className="btn btn-outline btn-block mt-3" disabled>Active Plan</button>
              </div>

              {/* Pro Agent Plan */}
              <div className="pricing-card featured">
                <h3>{t.proPlan}</h3>
                <div className="price">10,000 {t.currency}<span>/ month</span></div>
                <ul>
                  <li>All AI Engines (Claude, OpenAI)</li>
                  <li>Full Bulk Campaigns</li>
                  <li>Advanced CRM Tags & Filters</li>
                  <li>Fast Agent Response Time</li>
                </ul>
                <button 
                  className="btn btn-primary btn-block mt-3"
                  onClick={() => {
                    setPayAmount(10000);
                    setPayStatus('input');
                  }}
                >
                  Subscribe (10k)
                </button>
              </div>

              {/* Elite Enterprise Plan */}
              <div className="pricing-card">
                <h3>{t.premiumPlan}</h3>
                <div className="price">25,000 {t.currency}<span>/ month</span></div>
                <ul>
                  <li>Unlimited Contacts & History</li>
                  <li>High-speed bulk queuing</li>
                  <li>Priority Server Bandwidth</li>
                  <li>Dedicated Support agent</li>
                </ul>
                <button 
                  className="btn btn-primary btn-block mt-3"
                  onClick={() => {
                    setPayAmount(25000);
                    setPayStatus('input');
                  }}
                >
                  Subscribe (25k)
                </button>
              </div>
            </div>

            {/* Payment Input Modal/Section */}
            {(payStatus === 'input' || payStatus === 'processing' || payStatus === 'success') && (
              <div className="payment-modal content-card mt-5">
                <h2>Complete Subscription Payment</h2>
                <p>Package upgrade: <strong>{payAmount === 10000 ? t.proPlan : t.premiumPlan}</strong> ({payAmount.toLocaleString()} {t.currency})</p>

                {payStatus === 'input' && (
                  <form onSubmit={handlePayment}>
                    <div className="form-group">
                      <label>{t.inputPaymentPhone}</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. 0768222333"
                        value={payPhone}
                        onChange={e => setPayPhone(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Select Payment Provider</label>
                      <div className="payment-providers">
                        <label className="provider-option">
                          <input 
                            type="radio" 
                            name="provider" 
                            value="mpesa"
                            checked={payProvider === 'mpesa'}
                            onChange={() => setPayProvider('mpesa')}
                          />
                          <span>Vodacom M-Pesa</span>
                        </label>
                        <label className="provider-option">
                          <input 
                            type="radio" 
                            name="provider" 
                            value="tigopesa"
                            checked={payProvider === 'tigopesa'}
                            onChange={() => setPayProvider('tigopesa')}
                          />
                          <span>Tigo Pesa</span>
                        </label>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary">{t.payNow}</button>
                  </form>
                )}

                {payStatus === 'processing' && (
                  <div className="payment-spinner">
                    <Loader className="spin" size={48} />
                    <p>{t.paymentProcessing}</p>
                    <span className="ref-display">Transaction Ref: {payRef}</span>
                  </div>
                )}

                {payStatus === 'success' && (
                  <div className="payment-success-box">
                    <CheckCircle size={64} className="text-success" />
                    <p>{t.paymentSuccess}</p>
                    <button className="btn btn-primary" onClick={() => setPayStatus('')}>Close</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
