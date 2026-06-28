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
  Play,
  Shield,
  Package,
  Tag,
  Image,
  Paperclip,
  Smile,
  Mic,
  ShoppingBag,
  FileText,
  MoreVertical,
  RefreshCw
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
    model: 'gemini-2.0-flash',
    api_key: '',
    system_prompt: '',
    support_prompt: '',
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

  // Admin States
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminPayments, setAdminPayments] = useState([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [selectedAdminUser, setSelectedAdminUser] = useState(null);
  const [adminPlanForm, setAdminPlanForm] = useState({ plan: 'pro', days: 30 });

  // Catalog States
  const [catalog, setCatalog] = useState([]);
  const [catalogForm, setCatalogForm] = useState({ name: '', price: '', description: '', status: 'available' });
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Coupons States
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({ code: '', discount_type: 'fixed', value: '', active: 1 });
  const [selectedCoupon, setSelectedCoupon] = useState(null);

  // Cart States
  const [carts, setCarts] = useState([]);

  // WooCommerce States
  const [wooConfig, setWooConfig] = useState({
    domain_name: '',
    consumer_key: '',
    consumer_secret: '',
    active: 0,
    sync_products: 0,
    create_orders: 0
  });
  const [wooSaveMsg, setWooSaveMsg] = useState('');
  const [isSyncingWoo, setIsSyncingWoo] = useState(false);

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

  // Admin helper API calls
  const fetchAdminUsers = async () => {
    try {
      const data = await apiFetch('/api/admin/users');
      setAdminUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminPayments = async () => {
    try {
      const data = await apiFetch('/api/admin/payments');
      setAdminPayments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateUserPlan = async (e) => {
    e.preventDefault();
    if (!selectedAdminUser) return;
    try {
      await apiFetch(`/api/admin/users/${selectedAdminUser.id}/plan`, {
        method: 'POST',
        body: JSON.stringify(adminPlanForm)
      });
      alert('Plan updated successfully');
      setSelectedAdminUser(null);
      fetchAdminUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      alert('User deleted successfully');
      fetchAdminUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  // Run admin fetchers
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'admin' && user.role === 'admin') {
      fetchAdminUsers();
      fetchAdminPayments();
    }
  }, [activeTab, user]);

  // Catalog and Coupon API Fetchers & Handlers
  const fetchCatalog = async () => {
    try {
      const data = await apiFetch('/api/catalog');
      setCatalog(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCoupons = async () => {
    try {
      const data = await apiFetch('/api/coupons');
      setCoupons(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/catalog', {
        method: 'POST',
        body: JSON.stringify({
          id: selectedProduct?.id,
          ...catalogForm,
          price: parseFloat(catalogForm.price)
        })
      });
      alert('Product saved successfully');
      setCatalogForm({ name: '', price: '', description: '', status: 'available' });
      setSelectedProduct(null);
      fetchCatalog();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await apiFetch(`/api/catalog/${id}`, { method: 'DELETE' });
      fetchCatalog();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/coupons', {
        method: 'POST',
        body: JSON.stringify({
          id: selectedCoupon?.id,
          ...couponForm,
          value: parseFloat(couponForm.value)
        })
      });
      alert('Coupon saved successfully');
      setCouponForm({ code: '', discount_type: 'fixed', value: '', active: 1 });
      setSelectedCoupon(null);
      fetchCoupons();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await apiFetch(`/api/coupons/${id}`, { method: 'DELETE' });
      fetchCoupons();
    } catch (err) {
      alert(err.message);
    }
  };

  const fetchCarts = async () => {
    try {
      const data = await apiFetch('/api/carts');
      setCarts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWooConfig = async () => {
    try {
      const data = await apiFetch('/api/config/woocommerce');
      setWooConfig(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveWooConfig = async (e) => {
    e.preventDefault();
    setWooSaveMsg('');
    try {
      await apiFetch('/api/config/woocommerce', {
        method: 'POST',
        body: JSON.stringify(wooConfig)
      });
      setWooSaveMsg('WooCommerce configuration updated successfully');
      setTimeout(() => setWooSaveMsg(''), 4000);
    } catch (err) {
      setWooSaveMsg('Error: ' + err.message);
    }
  };

  const handleSyncWooProducts = async () => {
    setIsSyncingWoo(true);
    try {
      const data = await apiFetch('/api/config/woocommerce/sync', { method: 'POST' });
      alert(data.message || 'WooCommerce products synced successfully!');
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      setIsSyncingWoo(false);
    }
  };

  // Run catalog/coupon/cart fetchers
  useEffect(() => {
    if (!token) return;
    if (activeTab === 'catalog') fetchCatalog();
    if (activeTab === 'coupons') fetchCoupons();
    if (activeTab === 'woocommerce') fetchWooConfig();
    if (activeTab === 'dashboard') {
      fetchCarts();
    }
  }, [activeTab, token]);

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

          <button 
            className={`nav-item ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <Package size={20} />
            <span>{t.catalog}</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'coupons' ? 'active' : ''}`}
            onClick={() => setActiveTab('coupons')}
          >
            <Tag size={20} />
            <span>{t.coupons}</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'woocommerce' ? 'active' : ''}`}
            onClick={() => setActiveTab('woocommerce')}
          >
            <ShoppingBag size={20} />
            <span>WooCommerce</span>
          </button>

          {user && user.role === 'admin' && (
            <button 
              className={`nav-item ${activeTab === 'admin' ? 'active text-warning' : 'text-warning'}`}
              onClick={() => setActiveTab('admin')}
            >
              <Shield size={20} />
              <span>{t.superAdmin}</span>
            </button>
          )}
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

            <div className="content-card mt-3">
              <h2>Vikapu Vinavyofuatiliwa na AI (Abandoned Carts / Retargeting)</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '15px' }}>
                Wateja wanaoanza ku-order lakini wakaishia njiani. Mfumo utawatumia ukumbusho kiotomatiki baada ya dakika 30.
              </p>
              {carts.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Hakuna vikapu amilifu vinavyofuatiliwa kwa sasa.</p>
              ) : (
                <div className="logs-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {carts.map(c => (
                    <div key={c.id} className="log-item" style={{ marginBottom: '8px', padding: '12px' }}>
                      <div className="log-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0 }}>{c.contact_name || 'Mteja'} (+{c.contact_phone})</h4>
                        <span className={`badge badge-${c.reminder_sent === 1 ? 'completed' : 'pending'}`}>
                          {c.reminder_sent === 1 ? 'Ukumbusho Umetumwa' : 'Inasubiri (Active)'}
                        </span>
                      </div>
                      <p className="log-text" style={{ fontSize: '0.85rem', margin: '5px 0' }}>
                        <strong>Ujumbe wa Mwisho:</strong> {c.cart_data}
                      </p>
                      <span className="log-time" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Kupitiwa Mwisho: {new Date(c.last_activity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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

                {user && user.role === 'admin' && (
                  <div className="form-group">
                    <label>{t.apiKeyOverride}</label>
                    <input 
                      type="password" 
                      value={aiConfig.api_key}
                      placeholder="sk-..."
                      onChange={e => setAiConfig({ ...aiConfig, api_key: e.target.value })}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>{t.systemPrompt}</label>
                  <textarea 
                    rows={6}
                    value={aiConfig.system_prompt}
                    onChange={e => setAiConfig({ ...aiConfig, system_prompt: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>{t.supportPrompt}</label>
                  <textarea 
                    rows={6}
                    value={aiConfig.support_prompt || ''}
                    onChange={e => setAiConfig({ ...aiConfig, support_prompt: e.target.value })}
                    placeholder="Maagizo maalum ya Msaidizi wa Malalamiko na Support..."
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
                    <span className="checkbox-label">{aiConfig.enabled === 1 ? t.disableAI : t.enableAI}</span>
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
                      <div className="chat-header-wrapper">
                        <div>
                          <h3>{selectedContact.name || 'Unknown'}</h3>
                          <span>+{selectedContact.phone_number}</span>
                        </div>
                        <div className="chat-header-actions">
                          {/* Agent Mode Badge */}
                          <span className={`mode-badge mode-${selectedContact.agent_mode || 'sales'}`}>
                            {selectedContact.agent_mode === 'support' ? 'Support Mode' : 'Sales Mode'}
                          </span>
                          
                          {/* Assignee Dropdown */}
                          <select 
                            value={selectedContact.assignee || 'unassigned'}
                            onChange={async (e) => {
                              const newAssignee = e.target.value;
                              try {
                                const updated = await apiFetch(`/api/crm/contacts/${selectedContact.id}/settings`, {
                                  method: 'POST',
                                  body: JSON.stringify({ assignee: newAssignee })
                                });
                                setSelectedContact(updated);
                                fetchContacts();
                              } catch (err) {
                                alert(err.message);
                              }
                            }}
                            className="assignee-select"
                          >
                            <option value="unassigned">Unassigned</option>
                            <option value="me">Assigned to Me</option>
                            <option value="support">Technical Support</option>
                          </select>

                          {/* Manual Refresh Button */}
                          <button 
                            type="button" 
                            className="btn-header-action" 
                            title="Refresh Messages"
                            onClick={() => fetchChatMessages(selectedContact.id)}
                          >
                            <RefreshCw size={16} />
                          </button>
                        </div>
                      </div>
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

                    <div className="chat-input-panel">
                      <textarea 
                        placeholder={t.typeMessage}
                        value={newMsgText}
                        onChange={e => setNewMsgText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendManualMsg(e);
                          }
                        }}
                        rows={2}
                        className="chat-textarea"
                      />
                      <div className="chat-toolbar">
                        <div className="toolbar-left">
                          <button type="button" className="toolbar-btn" title="Upload Image" onClick={() => alert('Feature: Image upload coming soon!')}>
                            <Image size={18} />
                          </button>
                          <button type="button" className="toolbar-btn" title="Attach Document" onClick={() => alert('Feature: Document attachment coming soon!')}>
                            <Paperclip size={18} />
                          </button>
                          <button type="button" className="toolbar-btn" title="Add Emoji" onClick={() => setNewMsgText(prev => prev + ' 😊')}>
                            <Smile size={18} />
                          </button>
                          <button type="button" className="toolbar-btn" title="Send Voice Note" onClick={() => alert('Feature: Push-to-talk recording coming soon!')}>
                            <Mic size={18} />
                          </button>
                          
                          {/* AI Auto-responder Toggle */}
                          <button 
                            type="button" 
                            className={`toolbar-btn ${selectedContact.ai_disabled === 1 ? 'ai-disabled' : 'ai-enabled'}`}
                            title={selectedContact.ai_disabled === 1 ? "Washa AI Auto-responder" : "Zima AI Auto-responder"}
                            onClick={async () => {
                              const newStatus = selectedContact.ai_disabled === 1 ? 0 : 1;
                              try {
                                const updated = await apiFetch(`/api/crm/contacts/${selectedContact.id}/settings`, {
                                  method: 'POST',
                                  body: JSON.stringify({ ai_disabled: newStatus })
                                });
                                setSelectedContact(updated);
                                fetchContacts();
                              } catch (err) {
                                alert(err.message);
                              }
                            }}
                          >
                            <Bot size={18} />
                          </button>

                          {/* Quick Catalog link injection */}
                          <button 
                            type="button" 
                            className="toolbar-btn" 
                            title="Send Catalog Options" 
                            onClick={() => {
                              setNewMsgText(prev => prev + '\nOrodha ya bidhaa zetu: \n1. Sukari (TZS 3,000)\n2. Mchele (TZS 2,500)\nUnakaribishwa kuagiza!');
                            }}
                          >
                            <ShoppingBag size={18} />
                          </button>
                        </div>
                        <div className="toolbar-right">
                          <button type="button" onClick={handleSendManualMsg} className="btn btn-primary btn-send-icon">
                            <Send size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
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

        {/* TAB 7: SUPER ADMIN */}
        {activeTab === 'admin' && user.role === 'admin' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h1>{t.superAdmin}</h1>
              <p>Manage SaaS users, subscription billing, and override permissions.</p>
            </div>

            <div className="grid grid-2">
              {/* Users list management */}
              <div className="content-card">
                <h2>{t.userManagement}</h2>
                <div className="search-bar-wrapper mb-3">
                  <Search size={18} />
                  <input 
                    type="text" 
                    placeholder="Search users..." 
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                  />
                </div>

                <div className="logs-list" style={{ maxHeight: '400px' }}>
                  {adminUsers
                    .filter(u => u.name?.toLowerCase().includes(adminSearch.toLowerCase()) || u.email?.toLowerCase().includes(adminSearch.toLowerCase()))
                    .map(u => (
                      <div key={u.id} className="log-item" style={{ marginBottom: '8px', padding: '12px' }}>
                        <div className="log-header">
                          <h4>{u.name} ({u.role})</h4>
                          <span className={`badge badge-${u.plan === 'free' ? 'failed' : 'completed'}`}>
                            {u.plan.toUpperCase()}
                          </span>
                        </div>
                        <p className="log-text" style={{ fontSize: '0.85rem' }}>{u.email}</p>
                        <p className="log-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Expires: {u.active_until ? new Date(u.active_until).toLocaleDateString() : 'Lifetime'}
                        </p>
                        <div className="button-group mt-2" style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => {
                              setSelectedAdminUser(u);
                              setAdminPlanForm({ plan: u.plan, days: 30 });
                            }}
                          >
                            {t.changePlan}
                          </button>
                          {u.email !== 'nurwaka@gmail.com' && (
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              onClick={() => handleDeleteUser(u.id)}
                            >
                              {t.delete}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Adjust plan form / Details panel */}
              <div className="content-card">
                {selectedAdminUser ? (
                  <div>
                    <h2>Adjust Plan: {selectedAdminUser.name}</h2>
                    <form onSubmit={handleUpdateUserPlan}>
                      <div className="form-group">
                        <label>SaaS Package</label>
                        <select 
                          value={adminPlanForm.plan}
                          onChange={e => setAdminPlanForm({ ...adminPlanForm, plan: e.target.value })}
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro Agent</option>
                          <option value="premium">Elite Enterprise</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>{t.days} (Validity from now)</label>
                        <input 
                          type="number"
                          value={adminPlanForm.days}
                          onChange={e => setAdminPlanForm({ ...adminPlanForm, days: parseInt(e.target.value) })}
                        />
                      </div>

                      <div className="button-group">
                        <button type="submit" className="btn btn-primary">Update Plan</button>
                        <button type="button" className="btn btn-outline" onClick={() => setSelectedAdminUser(null)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div>
                    <h2>{t.paymentsLog}</h2>
                    <div className="logs-list" style={{ maxHeight: '400px' }}>
                      {adminPayments.length === 0 ? (
                        <p>No payments recorded yet.</p>
                      ) : (
                        adminPayments.map(p => (
                          <div key={p.id} className="log-item" style={{ marginBottom: '8px', padding: '12px' }}>
                            <div className="log-header">
                              <h4>{p.reference}</h4>
                              <span className={`badge badge-${p.status === 'success' ? 'completed' : 'failed'}`}>
                                {p.status.toUpperCase()}
                              </span>
                            </div>
                            <p className="log-text" style={{ fontSize: '0.8rem' }}>
                              User: {p.user_email} <br />
                              Phone: {p.phone_number} <br />
                              Amount: {p.amount.toLocaleString()} TZS ({p.provider.toUpperCase()})
                            </p>
                            <span className="log-time">{new Date(p.created_at).toLocaleString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: CATALOG */}
        {activeTab === 'catalog' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h1>{t.catalog}</h1>
              <p>Manage product items, prices, and stock status. The AI Agent will read this catalog dynamically.</p>
            </div>

            <div className="grid grid-2">
              {/* Product list table */}
              <div className="content-card">
                <h2>All Products</h2>
                <div className="logs-list" style={{ maxHeight: '500px' }}>
                  {catalog.length === 0 ? (
                    <p>No products in catalog. Add your first product on the right.</p>
                  ) : (
                    catalog.map(p => (
                      <div key={p.id} className="log-item" style={{ marginBottom: '8px', padding: '12px' }}>
                        <div className="log-header">
                          <h4>{p.name}</h4>
                          <span className={`badge badge-${p.status === 'available' ? 'completed' : 'failed'}`}>
                            {p.status === 'available' ? t.available : t.outOfStock}
                          </span>
                        </div>
                        <p className="log-text"><strong>Price:</strong> {p.price.toLocaleString()} TZS</p>
                        <p className="log-text" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.description || 'No description'}</p>
                        <div className="button-group mt-2" style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => {
                              setSelectedProduct(p);
                              setCatalogForm({ name: p.name, price: p.price, description: p.description, status: p.status });
                            }}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleDeleteProduct(p.id)}
                          >
                            {t.delete}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Product Add/Edit Form */}
              <div className="content-card">
                <h2>{selectedProduct ? 'Edit Product' : 'Add New Product'}</h2>
                <form onSubmit={handleSaveProduct}>
                  <div className="form-group">
                    <label>{t.productName}</label>
                    <input 
                      type="text" 
                      required 
                      value={catalogForm.name}
                      onChange={e => setCatalogForm({ ...catalogForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.productPrice}</label>
                    <input 
                      type="number" 
                      required 
                      value={catalogForm.price}
                      onChange={e => setCatalogForm({ ...catalogForm, price: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.productDesc}</label>
                    <textarea 
                      rows={3} 
                      value={catalogForm.description || ''}
                      onChange={e => setCatalogForm({ ...catalogForm, description: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.productStatus}</label>
                    <select 
                      value={catalogForm.status}
                      onChange={e => setCatalogForm({ ...catalogForm, status: e.target.value })}
                    >
                      <option value="available">{t.available}</option>
                      <option value="out_of_stock">{t.outOfStock}</option>
                    </select>
                  </div>

                  <div className="button-group">
                    <button type="submit" className="btn btn-primary">Save Product</button>
                    {selectedProduct && (
                      <button 
                        type="button" 
                        className="btn btn-outline" 
                        onClick={() => {
                          setSelectedProduct(null);
                          setCatalogForm({ name: '', price: '', description: '', status: 'available' });
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: COUPONS */}
        {activeTab === 'coupons' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h1>{t.coupons}</h1>
              <p>Create discount promo codes. The AI Agent will read active coupons and apply discounts automatically during checkout.</p>
            </div>

            <div className="grid grid-2">
              {/* Coupons List Table */}
              <div className="content-card">
                <h2>All Coupons</h2>
                <div className="logs-list" style={{ maxHeight: '500px' }}>
                  {coupons.length === 0 ? (
                    <p>No coupons created yet. Create your first promo code on the right.</p>
                  ) : (
                    coupons.map(c => (
                      <div key={c.id} className="log-item" style={{ marginBottom: '8px', padding: '12px' }}>
                        <div className="log-header">
                          <h4>{c.code}</h4>
                          <span className={`badge badge-${c.active === 1 ? 'completed' : 'failed'}`}>
                            {c.active === 1 ? t.active : t.inactive}
                          </span>
                        </div>
                        <p className="log-text">
                          <strong>Discount:</strong> {c.discount_type === 'percentage' ? `${c.value}%` : `${c.value.toLocaleString()} TZS`}
                        </p>
                        <div className="button-group mt-2" style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => {
                              setSelectedCoupon(c);
                              setCouponForm({ code: c.code, discount_type: c.discount_type, value: c.value, active: c.active });
                            }}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleDeleteCoupon(c.id)}
                          >
                            {t.delete}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Coupon Add/Edit Form */}
              <div className="content-card">
                <h2>{selectedCoupon ? 'Edit Coupon' : 'Create New Coupon'}</h2>
                <form onSubmit={handleSaveCoupon}>
                  <div className="form-group">
                    <label>{t.couponCode}</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. OFA20, RAMADHAN"
                      value={couponForm.code}
                      onChange={e => setCouponForm({ ...couponForm, code: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.discountType}</label>
                    <select 
                      value={couponForm.discount_type}
                      onChange={e => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                    >
                      <option value="fixed">{t.fixed}</option>
                      <option value="percentage">{t.percentage}</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{t.discountValue}</label>
                    <input 
                      type="number" 
                      required 
                      value={couponForm.value}
                      onChange={e => setCouponForm({ ...couponForm, value: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.active} Status</label>
                    <select 
                      value={couponForm.active}
                      onChange={e => setCouponForm({ ...couponForm, active: parseInt(e.target.value) })}
                    >
                      <option value="1">{t.active}</option>
                      <option value="0">{t.inactive}</option>
                    </select>
                  </div>

                  <div className="button-group">
                    <button type="submit" className="btn btn-primary">Save Coupon</button>
                    {selectedCoupon && (
                      <button 
                        type="button" 
                        className="btn btn-outline" 
                        onClick={() => {
                          setSelectedCoupon(null);
                          setCouponForm({ code: '', discount_type: 'fixed', value: '', active: 1 });
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 10: WOOCOMMERCE */}
        {activeTab === 'woocommerce' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h1>WooCommerce Settings</h1>
              <p>Connect your WooCommerce store to sync product inventory and capture WhatsApp orders.</p>
            </div>

            <div className="grid grid-2">
              {/* Settings Form */}
              <div className="content-card">
                <h2>Configure Integration</h2>
                <form onSubmit={handleSaveWooConfig}>
                  {wooSaveMsg && (
                    <div className={`alert ${wooSaveMsg.startsWith('Error') ? 'alert-danger' : 'alert-success'}`}>
                      {wooSaveMsg}
                    </div>
                  )}

                  <div className="form-group">
                    <label>Domain Name *</label>
                    <input 
                      type="url" 
                      required 
                      placeholder="https://yourstore.com"
                      value={wooConfig.domain_name}
                      onChange={e => setWooConfig({ ...wooConfig, domain_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Consumer Key *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="ck_..."
                      value={wooConfig.consumer_key}
                      onChange={e => setWooConfig({ ...wooConfig, consumer_key: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Consumer Secret *</label>
                    <input 
                      type="password" 
                      required 
                      placeholder="cs_..."
                      value={wooConfig.consumer_secret}
                      onChange={e => setWooConfig({ ...wooConfig, consumer_secret: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={wooConfig.active}
                      onChange={e => setWooConfig({ ...wooConfig, active: parseInt(e.target.value) })}
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ flexDirection: 'row', gap: '10px', alignItems: 'center' }}>
                    <input 
                      type="checkbox" 
                      id="sync_products"
                      checked={wooConfig.sync_products === 1}
                      onChange={e => setWooConfig({ ...wooConfig, sync_products: e.target.checked ? 1 : 0 })}
                    />
                    <label htmlFor="sync_products" style={{ cursor: 'pointer', fontWeight: 'normal' }}>Import WooCommerce Products</label>
                  </div>

                  <div className="form-group" style={{ flexDirection: 'row', gap: '10px', alignItems: 'center' }}>
                    <input 
                      type="checkbox" 
                      id="create_orders"
                      checked={wooConfig.create_orders === 1}
                      onChange={e => setWooConfig({ ...wooConfig, create_orders: e.target.checked ? 1 : 0 })}
                    />
                    <label htmlFor="create_orders" style={{ cursor: 'pointer', fontWeight: 'normal' }}>Create WooCommerce Orders & Send</label>
                  </div>

                  <div className="button-group mt-3" style={{ display: 'flex', gap: '12px' }}>
                    <button type="submit" className="btn btn-primary">Save Settings</button>
                    {wooConfig.active === 1 && (
                      <button 
                        type="button" 
                        className="btn btn-outline"
                        onClick={handleSyncWooProducts}
                        disabled={isSyncingWoo}
                      >
                        {isSyncingWoo ? <Loader className="spin" size={16} /> : 'Sync Products Now'}
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Instructions Guide */}
              <div className="content-card">
                <h2>Get Your WooCommerce Keys</h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.6' }}>
                  <p>To integrate with WooCommerce you will need your store URL, consumer key, and consumer secret API keys.</p>
                  <ol style={{ paddingLeft: '20px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>Log in to your WordPress admin panel and navigate to <strong>WooCommerce settings</strong>.</li>
                    <li>Go to the <strong>Advanced</strong> tab, click on <strong>REST API</strong>, and click <strong>Add key</strong>.</li>
                    <li>Enter a description, select user, and set permissions to <strong>Read/Write</strong>, then generate the API keys.</li>
                    <li>Copy the <strong>Consumer Key</strong> and <strong>Consumer Secret</strong> and paste them in the settings form.</li>
                    <li>Your store URL is usually in the format: <code>https://yourstore.com</code></li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
