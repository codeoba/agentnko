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
  RefreshCw,
  Cpu,
  PlayCircle,
  BarChart3,
  Target,
  Clock,
  Filter,
  Globe,
  FlaskConical,
  ShieldCheck,
  UserCheck,
  Zap
} from 'lucide-react';

// Enterprise Components
import AnalyticsDashboard from './components/AnalyticsDashboard.jsx';
import LeadScoring from './components/LeadScoring.jsx';
import ScheduledMessages from './components/ScheduledMessages.jsx';
import ContactSegments from './components/ContactSegments.jsx';
import QuickReplies from './components/QuickReplies.jsx';
import OrderManager from './components/OrderManager.jsx';
import TeamInbox from './components/TeamInbox.jsx';
import WebhookManager from './components/WebhookManager.jsx';
import ABTesting from './components/ABTesting.jsx';
import ComplianceManager from './components/ComplianceManager.jsx';


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
  const [settingsTab, setSettingsTab] = useState('whatsapp');

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

  // Automations States
  const [automations, setAutomations] = useState([]);
  
  // WhatsApp Gateway States
  const [gatewayConfig, setGatewayConfig] = useState({
    gateway_type: 'baileys',
    meta_access_token: '',
    meta_phone_number_id: '',
    meta_waba_id: '',
    meta_verify_token: ''
  });
  const [gatewaySaveMsg, setGatewaySaveMsg] = useState('');
  const [showAddAutomation, setShowAddAutomation] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const [automationForm, setAutomationForm] = useState({
    name: '',
    description: '',
    trigger_type: 'message_received',
    condition_type: 'contains',
    condition_value: '',
    action_type: 'send_message',
    action_value: '',
    active: 1
  });

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

  // WhatsApp Gateway Config helpers
  const fetchGatewayConfig = async () => {
    try {
      const data = await apiFetch('/api/config/whatsapp-gateway');
      setGatewayConfig(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveGatewayConfig = async (e) => {
    e.preventDefault();
    setGatewaySaveMsg('');
    try {
      await apiFetch('/api/config/whatsapp-gateway', {
        method: 'POST',
        body: JSON.stringify(gatewayConfig)
      });
      setGatewaySaveMsg('Settings saved successfully.');
      setTimeout(() => setGatewaySaveMsg(''), 4000);
    } catch (err) {
      setGatewaySaveMsg('Error: ' + err.message);
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

  const fetchAutomations = async () => {
    try {
      const data = await apiFetch('/api/automations');
      setAutomations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAutomation = async (e) => {
    e.preventDefault();
    try {
      const payload = selectedAutomation ? { ...automationForm, id: selectedAutomation.id } : automationForm;
      await apiFetch('/api/automations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setShowAddAutomation(false);
      setSelectedAutomation(null);
      setAutomationForm({
        name: '',
        description: '',
        trigger_type: 'message_received',
        condition_type: 'contains',
        condition_value: '',
        action_type: 'send_message',
        action_value: '',
        active: 1
      });
      fetchAutomations();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAutomation = async (id) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await apiFetch(`/api/automations/${id}`, { method: 'DELETE' });
      fetchAutomations();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleAutomation = async (id, currentActive) => {
    const nextActive = currentActive === 1 ? 0 : 1;
    try {
      await apiFetch(`/api/automations/${id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ active: nextActive })
      });
      fetchAutomations();
    } catch (err) {
      alert(err.message);
    }
  };

  // Run catalog/coupon/cart fetchers
  useEffect(() => {
    if (!token) return;
    if (activeTab === 'catalog') fetchCatalog();
    if (activeTab === 'coupons') fetchCoupons();
    if (activeTab === 'automations') fetchAutomations();
    if (activeTab === 'dashboard') {
      fetchCarts();
    }
    if (activeTab === 'settings') {
      if (settingsTab === 'whatsapp') {
        fetchSessionStatus();
        fetchGatewayConfig();
      }
      if (settingsTab === 'ai') fetchAIConfig();
      if (settingsTab === 'woocommerce') fetchWooConfig();
    }
  }, [activeTab, settingsTab, token]);

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
            className={`nav-item ${activeTab === 'automations' ? 'active' : ''}`}
            onClick={() => setActiveTab('automations')}
          >
            <Cpu size={20} />
            <span>Automations</span>
          </button>

          {/* ===== ENTERPRISE NAV ===== */}
          <div className="nav-section-label">Enterprise</div>

          <button 
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={20} />
            <span>Analytics</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'lead-scoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('lead-scoring')}
          >
            <Target size={20} />
            <span>Lead Scoring</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ShoppingBag size={20} />
            <span>Orders</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'scheduled' ? 'active' : ''}`}
            onClick={() => setActiveTab('scheduled')}
          >
            <Clock size={20} />
            <span>Scheduled</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'segments' ? 'active' : ''}`}
            onClick={() => setActiveTab('segments')}
          >
            <Filter size={20} />
            <span>Segments</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            <FileText size={20} />
            <span>Templates</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            <UserCheck size={20} />
            <span>Team</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'webhooks' ? 'active' : ''}`}
            onClick={() => setActiveTab('webhooks')}
          >
            <Globe size={20} />
            <span>Webhooks & API</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'abtesting' ? 'active' : ''}`}
            onClick={() => setActiveTab('abtesting')}
          >
            <FlaskConical size={20} />
            <span>A/B Testing</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setActiveTab('compliance')}
          >
            <ShieldCheck size={20} />
            <span>Compliance</span>
          </button>

          {/* ===== SETTINGS & ADMIN ===== */}
          <div className="nav-section-label">Mfumo</div>

          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
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
          <div className="page-container">

            {/* Topbar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '24px', paddingBottom: '20px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>Dashboard Overview</h1>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Welcome back! Here's what's happening with your WhatsApp business.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveTab('campaigns')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', padding: '9px 18px' }}
                >
                  <Plus size={16} /> New Campaign
                </button>
                <button className="btn-icon" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px' }} onClick={handleLogout} title="Logout">
                  <LogOut size={18} color="#6b7280" />
                </button>
              </div>
            </div>

            {/* 8 Stat Cards - WhatsWay Style */}
            <div className="grid grid-4 mb-4" style={{ gap: '16px' }}>
              <div className="stats-card">
                <Sparkles size={24} className="card-icon text-primary" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={18} color="#3b82f6" />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Total Contacts</span>
                </div>
                <h3 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>{stats.totalContacts}</h3>
              </div>

              <div className="stats-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={18} color="#f97316" />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Total Messages</span>
                </div>
                <h3 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>{stats.messagesProcessed}</h3>
              </div>

              <div className="stats-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#ecfeff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={18} color="#06b6d4" />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Sent</span>
                </div>
                <h3 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>{stats.campaignsSent || 0}</h3>
              </div>

              <div className="stats-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={18} color="#22c55e" />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Delivered</span>
                </div>
                <h3 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>{stats.activeAgents}</h3>
              </div>
            </div>

            {/* Second row - 4 more stat cards */}
            <div className="grid grid-4 mb-4" style={{ gap: '16px' }}>
              <div className="stats-card" style={{ borderLeftColor: '#8b5cf6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={18} color="#8b5cf6" />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Read</span>
                </div>
                <h3 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>0</h3>
              </div>

              <div className="stats-card" style={{ borderLeftColor: '#ec4899' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={18} color="#ec4899" />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Failed</span>
                </div>
                <h3 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>0</h3>
              </div>

              <div className="stats-card" style={{ borderLeftColor: '#eab308' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={18} color="#eab308" />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Today</span>
                </div>
                <h3 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>0</h3>
              </div>

              <div className="stats-card" style={{ borderLeftColor: '#ef4444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Megaphone size={18} color="#ef4444" />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Total Campaigns</span>
                </div>
                <h3 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>{stats.campaignsSent || 0}</h3>
              </div>
            </div>

            {/* Rate Cards row */}
            <div className="grid grid-2 mb-4" style={{ gap: '16px' }}>
              <div className="content-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={16} color="#22c55e" />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#374151' }}>Delivery Rate</h2>
                </div>
                <h3 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>
                  {stats.messagesProcessed > 0 ? ((stats.activeAgents / stats.messagesProcessed) * 100).toFixed(1) : '0.0'}%
                </h3>
                <div style={{ background: '#f3f4f6', borderRadius: '4px', height: '6px', marginBottom: '8px' }}>
                  <div style={{ background: '#22c55e', borderRadius: '4px', height: '6px', width: stats.messagesProcessed > 0 ? `${Math.min((stats.activeAgents / stats.messagesProcessed) * 100, 100)}%` : '0%', transition: 'width 0.5s ease' }}></div>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{stats.activeAgents} of {stats.messagesProcessed} messages</span>
              </div>

              <div className="content-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#fdf4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BarChart3 size={16} color="#a855f7" />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#374151' }}>Monthly Growth</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', marginBottom: '0' }}>11.1%</h3>
                  <span style={{ fontSize: '0.85rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>↘</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>This month vs last month</span>
              </div>
            </div>

            {/* Bottom 2-col: Quick Actions + API Status */}
            <div className="grid grid-2 mb-4" style={{ gap: '16px' }}>
              {/* Quick Actions */}
              <div className="content-card">
                <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} color="#f59e0b" /> Quick Actions
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { icon: <Users size={22} color="#3b82f6" />, bg: '#eff6ff', label: 'Import Contacts', sub: 'Upload CSV', tab: 'crm' },
                    { icon: <FileText size={22} color="#22c55e" />, bg: '#f0fdf4', label: 'New Template', sub: 'Create message template', tab: 'campaigns' },
                    { icon: <Cpu size={22} color="#8b5cf6" />, bg: '#f5f3ff', label: 'Build Flow', sub: 'Create automation', tab: 'automations' },
                    { icon: <BarChart3 size={22} color="#f97316" />, bg: '#fff7ed', label: 'View Reports', sub: 'Detailed analytics', tab: 'analytics' },
                  ].map((action, i) => (
                    <button key={i} onClick={() => setActiveTab(action.tab)} style={{
                      background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px',
                      padding: '16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', gap: '8px'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: '8px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {action.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>{action.label}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{action.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Status */}
              <div className="content-card">
                <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={18} color="#3b82f6" /> API Status & Connection
                </h2>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={18} color="#22c55e" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>WhatsApp Gateway</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{wsStatus.phone_number ? `+${wsStatus.phone_number}` : 'Not connected'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: wsStatus.status === 'connected' ? '#059669' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: wsStatus.status === 'connected' ? '#22c55e' : '#ef4444', display: 'inline-block' }}></span>
                    {wsStatus.status === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>AI Engine Health</span>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Last checked: just now</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ textAlign: 'center', background: '#ffffff', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#111827' }}>100%</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>API Uptime</div>
                    </div>
                    <div style={{ textAlign: 'center', background: '#ffffff', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#111827' }}>{aiConfig.enabled ? 'ON' : 'OFF'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>AI Status</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.825rem', padding: '8px 14px' }}
                    onClick={() => { setActiveTab('settings'); setSettingsTab('whatsapp'); }}>                    <Settings size={14} /> Manage Connection
                  </button>
                  <button className="btn" style={{ flex: 1, fontSize: '0.825rem', padding: '8px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151', borderRadius: '8px' }}
                    onClick={() => { setActiveTab('settings'); setSettingsTab('ai'); }}>
                    <Cpu size={14} /> AI Settings
                  </button>
                </div>
              </div>
            </div>


            {/* Vertical timeline Abandoned Carts section */}
            <div className="content-card mt-3">
              <h2>Vikapu vya Ununuzi vinavyofuatiliwa na AI (Abandoned Carts / Retargeting Timeline)</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
                Orodha ya wateja waliokaribia kununua bidhaa lakini wakasita njiani. AI inafuatilia na kutuma ujumbe wa ukumbusho baada ya dakika 30 kiotomatiki.
              </p>
              
              {carts.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <ShoppingBag size={32} style={{ marginBottom: '8px' }} />
                  <p>Hakuna vikapu amilifu vinavyofuatiliwa kwa sasa.</p>
                </div>
              ) : (
                <div className="timeline-carts-feed">
                  {carts.map(c => (
                    <div key={c.id} className={`timeline-cart-node ${c.reminder_sent === 1 ? 'completed' : 'active'}`}>
                      <div className="log-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '600' }}>{c.contact_name || 'Mteja'} (+{c.contact_phone})</h4>
                        <span className={`badge badge-${c.reminder_sent === 1 ? 'completed' : 'pending'}`}>
                          {c.reminder_sent === 1 ? 'Ukumbusho Umetumwa' : 'Inafuatiliwa na AI (Active)'}
                        </span>
                      </div>
                      <p className="log-text" style={{ fontSize: '0.88rem', margin: '8px 0', color: 'var(--text-secondary)' }}>
                        <strong>Ujumbe wa Mwisho:</strong> {c.cart_data}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span>Muda wa mwisho wa shughuli: {new Date(c.last_activity).toLocaleString()}</span>
                        <span>Mteja ID: #{c.contact_id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: AUTOMATION FLOWS */}
        {activeTab === 'automations' && (
          <div className="page-container">

            {/* ── Page Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(124,58,237,0.4)'
                  }}>
                    <Cpu size={20} color="#fff" />
                  </div>
                  <h1 style={{
                    fontFamily: 'var(--font-display)', fontSize: '1.75rem',
                    fontWeight: 800, letterSpacing: '-0.04em', margin: 0
                  }}>Automation Flows</h1>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                  Rule-based triggers that run 24/7 without manual intervention.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSelectedAutomation(null);
                  setAutomationForm({
                    name: '', description: '',
                    trigger_type: 'message_received',
                    condition_type: 'contains', condition_value: '',
                    action_type: 'send_message', action_value: '', active: 1
                  });
                  setShowAddAutomation(true);
                }}
                style={{ gap: '8px', padding: '10px 20px' }}
              >
                <Plus size={16} />
                Create New Flow
              </button>
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-3" style={{ marginBottom: '24px' }}>
              {/* Total Flows */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(79,70,229,0.06) 100%)',
                border: '1px solid rgba(124,58,237,0.2)',
                borderRadius: '16px', padding: '20px 24px',
                position: 'relative', overflow: 'hidden', transition: 'var(--transition)',
                cursor: 'default'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
                  background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', marginBottom: '14px',
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(124,58,237,0.4)'
                }}>
                  <Cpu size={18} color="#fff" />
                </div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', marginBottom: '4px', lineHeight: 1 }}>
                  {automations.length}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', fontWeight: 500 }}>Total Flows</div>
              </div>

              {/* Active Flows */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(34,211,165,0.1) 0%, rgba(5,150,105,0.05) 100%)',
                border: '1px solid rgba(34,211,165,0.18)',
                borderRadius: '16px', padding: '20px 24px',
                position: 'relative', overflow: 'hidden', transition: 'var(--transition)',
                cursor: 'default'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
                  background: 'radial-gradient(circle, rgba(34,211,165,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', marginBottom: '14px',
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(5,150,105,0.4)'
                }}>
                  <PlayCircle size={18} color="#fff" />
                </div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', marginBottom: '4px', lineHeight: 1, color: '#34d399' }}>
                  {automations.filter(a => a.active === 1).length}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', fontWeight: 500 }}>Active Flows</div>
              </div>

              {/* Total Executions */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(217,119,6,0.05) 100%)',
                border: '1px solid rgba(251,191,36,0.18)',
                borderRadius: '16px', padding: '20px 24px',
                position: 'relative', overflow: 'hidden', transition: 'var(--transition)',
                cursor: 'default'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
                  background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', marginBottom: '14px',
                  background: 'linear-gradient(135deg, #d97706, #b45309)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(217,119,6,0.4)'
                }}>
                  <CheckCircle size={18} color="#fff" />
                </div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', marginBottom: '4px', lineHeight: 1, color: '#fbbf24' }}>
                  {automations.reduce((acc, curr) => acc + (curr.runs_count || 0), 0)}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', fontWeight: 500 }}>Total Executions</div>
              </div>
            </div>

            {/* ── Automations Grid / Empty State ── */}
            {automations.length === 0 ? (

              /* ── ELITE EMPTY STATE ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Main empty hero */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(14,14,24,0.9) 0%, rgba(20,14,40,0.8) 100%)',
                  border: '1px solid rgba(124,58,237,0.15)',
                  borderRadius: '20px', padding: '56px 32px', textAlign: 'center',
                  position: 'relative', overflow: 'hidden'
                }}>
                  {/* Decorative orbs */}
                  <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
                    width: '280px', height: '160px',
                    background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)',
                    pointerEvents: 'none' }} />

                  {/* Animated icon cluster */}
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                    <div style={{
                      width: '80px', height: '80px', borderRadius: '20px',
                      background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.1))',
                      border: '1px solid rgba(124,58,237,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 40px rgba(124,58,237,0.15)',
                      animation: 'float 3s ease-in-out infinite'
                    }}>
                      <Cpu size={36} style={{ color: '#a78bfa' }} />
                    </div>
                    {/* Ripple rings */}
                    <div style={{
                      position: 'absolute', inset: '-16px', borderRadius: '36px',
                      border: '1px solid rgba(124,58,237,0.12)',
                      animation: 'glow-pulse 2.5s ease-in-out infinite'
                    }} />
                    <div style={{
                      position: 'absolute', inset: '-32px', borderRadius: '48px',
                      border: '1px solid rgba(124,58,237,0.06)'
                    }} />
                  </div>

                  <h2 style={{
                    fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800,
                    letterSpacing: '-0.03em', marginBottom: '10px', color: 'var(--text-primary)'
                  }}>No Automation Flows Yet</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 28px', lineHeight: 1.6 }}>
                    Build intelligent conversation rules that reply, tag, and route customers automatically — 24/7, without you lifting a finger.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowAddAutomation(true)}
                    style={{ padding: '11px 28px', fontSize: '0.9rem', gap: '8px' }}
                  >
                    <Plus size={16} />
                    Create Your First Flow
                  </button>
                </div>

                {/* Use-case suggestion cards */}
                <div style={{ marginTop: '4px' }}>
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)',
                    marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px'
                  }}>
                    Popular Use Cases
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                  </div>
                  <div className="grid grid-3">
                    {[
                      { icon: '👋', title: 'Welcome Message', desc: 'Auto-greet every new contact with a branded introduction.', trigger: 'new_conversation', badge: 'Trigger: New Chat', color: '#818cf8' },
                      { icon: '🏷️', title: 'Lead Tagger', desc: 'Tag contacts who mention "price" or "buy" as hot leads.', trigger: 'keyword_match', badge: 'Trigger: Keyword', color: '#34d399' },
                      { icon: '🤖', title: 'AI Handoff', desc: 'Disable AI and alert agent when a human escalation keyword is detected.', trigger: 'message_received', badge: 'Trigger: Message', color: '#fbbf24' },
                    ].map((uc) => (
                      <div
                        key={uc.title}
                        onClick={() => {
                          setAutomationForm({ name: uc.title, description: uc.desc, trigger_type: 'message_received', condition_type: 'contains', condition_value: '', action_type: 'send_message', action_value: '', active: 1 });
                          setSelectedAutomation(null);
                          setShowAddAutomation(true);
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.018)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '14px', padding: '20px',
                          cursor: 'pointer', transition: 'var(--transition)',
                          display: 'flex', flexDirection: 'column', gap: '10px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = `${uc.color}40`;
                          e.currentTarget.style.background = `rgba(255,255,255,0.035)`;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.background = 'rgba(255,255,255,0.018)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ fontSize: '1.6rem' }}>{uc.icon}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>{uc.title}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>{uc.desc}</div>
                        </div>
                        <div style={{
                          fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px',
                          background: `${uc.color}18`, color: uc.color,
                          border: `1px solid ${uc.color}30`,
                          borderRadius: '20px', alignSelf: 'flex-start',
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase'
                        }}>{uc.badge}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            ) : (
              /* ── AUTOMATION FLOW CARDS ── */
              <div className="grid grid-3">
                {automations.map(a => {
                  const isActive = a.active === 1;
                  const triggerLabels = {
                    message_received: 'Incoming Message',
                    new_conversation: 'New Conversation',
                  };
                  const actionLabels = {
                    send_message: 'Send Reply',
                    add_tag: 'Add Tag',
                    remove_tag: 'Remove Tag',
                    disable_ai: 'Mute AI',
                    enable_ai: 'Enable AI',
                  };

                  return (
                    <div key={a.id} style={{
                      background: isActive
                        ? 'linear-gradient(145deg, rgba(14,14,24,0.95) 0%, rgba(20,14,40,0.9) 100%)'
                        : 'rgba(14,14,24,0.7)',
                      border: `1px solid ${isActive ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)'}`,
                      borderRadius: '16px',
                      padding: '20px',
                      display: 'flex', flexDirection: 'column', gap: '16px',
                      transition: 'var(--transition)',
                      position: 'relative', overflow: 'hidden',
                      minHeight: '240px'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = isActive ? '0 12px 40px rgba(124,58,237,0.12)' : '0 8px 24px rgba(0,0,0,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      {/* Top accent line when active */}
                      {isActive && (
                        <div style={{
                          position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
                          background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.6), transparent)'
                        }} />
                      )}

                      {/* Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                          {/* Status dot */}
                          <div style={{
                            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                            background: isActive ? '#22d3a5' : '#5a5a72',
                            boxShadow: isActive ? '0 0 8px rgba(34,211,165,0.7)' : 'none',
                            animation: isActive ? 'live-pulse 2s infinite' : 'none'
                          }} />
                          <div style={{
                            fontSize: '0.95rem', fontWeight: 700,
                            fontFamily: 'var(--font-display)',
                            color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>{a.name}</div>
                        </div>
                        {/* Toggle */}
                        <label className="toggle-switch" style={{ flexShrink: 0 }}>
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => handleToggleAutomation(a.id, a.active)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      {/* Description */}
                      {a.description && (
                        <p style={{
                          fontSize: '0.82rem', color: 'var(--text-muted)',
                          lineHeight: 1.5, margin: 0,
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden'
                        }}>{a.description}</p>
                      )}

                      {/* ── Pipeline Visual: Trigger → Condition → Action ── */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {/* Trigger */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: 'rgba(251,191,36,0.08)',
                          border: '1px solid rgba(251,191,36,0.2)',
                          borderRadius: '8px', padding: '5px 10px'
                        }}>
                          <Play size={10} color="#fbbf24" />
                          <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {triggerLabels[a.trigger_type] || a.trigger_type}
                          </span>
                        </div>

                        {/* Arrow */}
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>→</div>

                        {/* Condition */}
                        {a.condition_type !== 'always' && (
                          <>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              background: 'rgba(96,165,250,0.08)',
                              border: '1px solid rgba(96,165,250,0.2)',
                              borderRadius: '8px', padding: '5px 10px',
                              maxWidth: '120px'
                            }}>
                              <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.condition_type}: "{a.condition_value}"
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>→</div>
                          </>
                        )}

                        {/* Action */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: 'rgba(34,211,165,0.08)',
                          border: '1px solid rgba(34,211,165,0.2)',
                          borderRadius: '8px', padding: '5px 10px'
                        }}>
                          <CheckCircle size={10} color="#22d3a5" />
                          <span style={{ fontSize: '0.72rem', color: '#22d3a5', fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {actionLabels[a.action_type] || a.action_type}
                          </span>
                        </div>
                      </div>

                      {/* Footer: runs + actions */}
                      <div style={{
                        marginTop: 'auto',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '14px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '6px',
                            background: 'rgba(255,255,255,0.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Play size={10} color="var(--text-muted)" />
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            <strong style={{ color: isActive ? '#22d3a5' : 'var(--text-secondary)' }}>{a.runs_count || 0}</strong> runs
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                            onClick={() => {
                              setSelectedAutomation(a);
                              setAutomationForm({
                                name: a.name, description: a.description || '',
                                trigger_type: a.trigger_type, condition_type: a.condition_type,
                                condition_value: a.condition_value || '', action_type: a.action_type,
                                action_value: a.action_value || '', active: a.active
                              });
                              setShowAddAutomation(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                            onClick={() => handleDeleteAutomation(a.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Create/Edit Flow Modal ── */}
            {showAddAutomation && (
              <div className="modal-overlay-blur">
                <div className="modal-content-premium" style={{ width: '580px' }}>

                  {/* Modal header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(124,58,237,0.4)'
                      }}>
                        <Cpu size={18} color="#fff" />
                      </div>
                      <div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                          {selectedAutomation ? 'Edit Flow' : 'Create Automation Flow'}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>Configure trigger, condition, and action</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => { setShowAddAutomation(false); setSelectedAutomation(null); }}
                      style={{ fontSize: '1.1rem', color: 'var(--text-muted)', padding: '6px' }}
                    >✕</button>
                  </div>

                  {/* Flow Pipeline Preview */}
                  <div style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px', padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginBottom: '24px', flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Preview:</span>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '6px', padding: '3px 8px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {automationForm.trigger_type}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>
                    {automationForm.condition_type !== 'always' && (
                      <>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', padding: '3px 8px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {automationForm.condition_type} "{automationForm.condition_value || '...'}"
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>
                      </>
                    )}
                    <span style={{ fontSize: '0.72rem', background: 'rgba(34,211,165,0.12)', color: '#22d3a5', border: '1px solid rgba(34,211,165,0.2)', borderRadius: '6px', padding: '3px 8px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {automationForm.action_type}
                    </span>
                  </div>

                  <form onSubmit={handleSaveAutomation}>
                    <div className="form-group">
                      <label>Flow Name *</label>
                      <input
                        type="text" required
                        placeholder="e.g. Welcome Message, Lead Tagging"
                        value={automationForm.name}
                        onChange={e => setAutomationForm({ ...automationForm, name: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Description</label>
                      <input
                        type="text"
                        placeholder="Brief description of what this flow does"
                        value={automationForm.description}
                        onChange={e => setAutomationForm({ ...automationForm, description: e.target.value })}
                      />
                    </div>

                    {/* Step 1: Trigger */}
                    <div style={{
                      background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)',
                      borderRadius: '12px', padding: '16px', marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#fbbf24', fontWeight: 800 }}>1</div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>Trigger Event</span>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <select
                          value={automationForm.trigger_type}
                          onChange={e => setAutomationForm({ ...automationForm, trigger_type: e.target.value })}
                        >
                          <option value="message_received">Incoming Message</option>
                          <option value="new_conversation">New Conversation</option>
                        </select>
                      </div>
                    </div>

                    {/* Step 2: Condition */}
                    <div style={{
                      background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.12)',
                      borderRadius: '12px', padding: '16px', marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#60a5fa', fontWeight: 800 }}>2</div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>Condition Match</span>
                      </div>
                      <div className="grid grid-2" style={{ marginBottom: automationForm.condition_type !== 'always' ? '12px' : 0 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <select
                            value={automationForm.condition_type}
                            onChange={e => setAutomationForm({ ...automationForm, condition_type: e.target.value })}
                          >
                            <option value="contains">Contains Keyword</option>
                            <option value="equals">Equals Exactly</option>
                            <option value="starts_with">Starts With</option>
                            <option value="always">Always Run</option>
                          </select>
                        </div>
                        {automationForm.condition_type !== 'always' && (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <input
                              type="text" required
                              placeholder="e.g. price, habari, help"
                              value={automationForm.condition_value}
                              onChange={e => setAutomationForm({ ...automationForm, condition_value: e.target.value })}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 3: Action */}
                    <div style={{
                      background: 'rgba(34,211,165,0.04)', border: '1px solid rgba(34,211,165,0.12)',
                      borderRadius: '12px', padding: '16px', marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(34,211,165,0.2)', border: '1px solid rgba(34,211,165,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#22d3a5', fontWeight: 800 }}>3</div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#22d3a5', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>Execute Action</span>
                      </div>
                      <div className="form-group" style={{ marginBottom: automationForm.action_type === 'send_message' || automationForm.action_type === 'add_tag' || automationForm.action_type === 'remove_tag' ? '12px' : 0 }}>
                        <select
                          value={automationForm.action_type}
                          onChange={e => setAutomationForm({ ...automationForm, action_type: e.target.value })}
                        >
                          <option value="send_message">Send Reply Message</option>
                          <option value="add_tag">Add Tag to Contact</option>
                          <option value="remove_tag">Remove Tag from Contact</option>
                          <option value="disable_ai">Mute / Disable AI Responder</option>
                          <option value="enable_ai">Unmute / Enable AI Responder</option>
                        </select>
                      </div>
                      {(automationForm.action_type === 'send_message' || automationForm.action_type === 'add_tag' || automationForm.action_type === 'remove_tag') && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ color: 'rgba(34,211,165,0.8)', fontSize: '0.72rem' }}>
                            {automationForm.action_type === 'send_message' ? 'Reply Message *' : 'Tag Value *'}
                          </label>
                          {automationForm.action_type === 'send_message' ? (
                            <textarea
                              rows={3} required
                              placeholder="Type the automatic reply here..."
                              value={automationForm.action_value}
                              onChange={e => setAutomationForm({ ...automationForm, action_value: e.target.value })}
                              style={{ resize: 'none' }}
                            />
                          ) : (
                            <input
                              type="text" required
                              placeholder="e.g. hot-lead, support, vip"
                              value={automationForm.action_value}
                              onChange={e => setAutomationForm({ ...automationForm, action_value: e.target.value })}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Modal buttons */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => { setShowAddAutomation(false); setSelectedAutomation(null); }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ gap: '8px' }}>
                        <CheckCircle size={15} />
                        {selectedAutomation ? 'Save Changes' : 'Create Flow'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: UNIFIED SETTINGS */}
        {activeTab === 'settings' && (
          <div className="page-container">
            <div className="pane-header">
              <h1>Settings</h1>
              <p>Configure your application channels, AI instructions, eCommerce sync, and subscription billing.</p>
            </div>

            <div className="settings-subtabs">
              <button 
                type="button" 
                className={`subtab-btn ${settingsTab === 'whatsapp' ? 'active' : ''}`} 
                onClick={() => setSettingsTab('whatsapp')}
              >
                <Wifi size={18} />
                <span>WhatsApp Connection</span>
              </button>
              <button 
                type="button" 
                className={`subtab-btn ${settingsTab === 'ai' ? 'active' : ''}`} 
                onClick={() => setSettingsTab('ai')}
              >
                <Bot size={18} />
                <span>AI Settings</span>
              </button>
              <button 
                type="button" 
                className={`subtab-btn ${settingsTab === 'woocommerce' ? 'active' : ''}`} 
                onClick={() => setSettingsTab('woocommerce')}
              >
                <ShoppingBag size={18} />
                <span>eCommerce (WooCommerce)</span>
              </button>
              <button 
                type="button" 
                className={`subtab-btn ${settingsTab === 'billing' ? 'active' : ''}`} 
                onClick={() => setSettingsTab('billing')}
              >
                <CreditCard size={18} />
                <span>Billing & Membership</span>
              </button>
            </div>

            {/* Sub-tab 1: WhatsApp Channels */}
            {settingsTab === 'whatsapp' && (
              <div>
                <div className="content-card mb-4">
                  <h2>WhatsApp Connection Mode</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                    Select whether to run self-hosted (using WhatsApp QR Code scan via Baileys) or using the official WhatsApp Business Cloud API (Meta).
                  </p>
                  
                  <div className="gateway-selector-grid" style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                    <button 
                      type="button" 
                      className={`btn ${gatewayConfig.gateway_type === 'baileys' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setGatewayConfig({ ...gatewayConfig, gateway_type: 'baileys' })}
                    >
                      🔌 Baileys Web Gateway (QR Code)
                    </button>
                    <button 
                      type="button" 
                      className={`btn ${gatewayConfig.gateway_type === 'meta_api' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setGatewayConfig({ ...gatewayConfig, gateway_type: 'meta_api' })}
                    >
                      🌐 Official Meta Cloud API
                    </button>
                  </div>

                  <form onSubmit={handleSaveGatewayConfig}>
                    {gatewaySaveMsg && (
                      <div className={`alert ${gatewaySaveMsg.startsWith('Error') ? 'alert-danger' : 'alert-success'}`}>
                        {gatewaySaveMsg}
                      </div>
                    )}

                    {gatewayConfig.gateway_type === 'meta_api' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div className="form-group">
                          <label>Access Token (Permanent User Token)</label>
                          <input 
                            type="password" 
                            required
                            placeholder="EAAG..."
                            value={gatewayConfig.meta_access_token || ''}
                            onChange={e => setGatewayConfig({ ...gatewayConfig, meta_access_token: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div className="form-group">
                            <label>Phone Number ID</label>
                            <input 
                              type="text" 
                              required
                              placeholder="e.g. 10982348574928"
                              value={gatewayConfig.meta_phone_number_id || ''}
                              onChange={e => setGatewayConfig({ ...gatewayConfig, meta_phone_number_id: e.target.value })}
                            />
                          </div>
                          <div className="form-group">
                            <label>WhatsApp Business Account ID (WABA ID)</label>
                            <input 
                              type="text" 
                              required
                              placeholder="e.g. 20984729487294"
                              value={gatewayConfig.meta_waba_id || ''}
                              onChange={e => setGatewayConfig({ ...gatewayConfig, meta_waba_id: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Verify Token (For Webhook Verification)</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. my_secret_token_123"
                            value={gatewayConfig.meta_verify_token || ''}
                            onChange={e => setGatewayConfig({ ...gatewayConfig, meta_verify_token: e.target.value })}
                          />
                        </div>

                        <div className="alert alert-info mt-2" style={{ fontSize: '0.85rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                          ℹ️ <strong>Configure Webhook in Meta Developer Portal:</strong><br />
                          Webhook URL: <code>{window.location.origin}/api/webhook/whatsapp/{user?.id}</code><br />
                          Verify Token: Match the verify token configured above.<br />
                          Webhook Fields: subscribe to <strong>messages</strong>.
                        </div>

                        <button type="submit" className="btn btn-primary mt-2">Save Meta Config</button>
                      </div>
                    ) : (
                      <div>
                        {/* Baileys connection UI */}
                        <div className="channel-card">
                          <div className="channel-card-body">
                            <div className="channel-card-details">
                              <h3>{wsStatus.phone_number ? `+${wsStatus.phone_number}` : 'No Active Channel'}</h3>
                              <div className="channel-meta-row">
                                <span>Channel Status:</span>
                                <strong className={wsStatus.status === 'connected' ? 'text-success' : 'text-danger'}>
                                  {wsStatus.status === 'connected' ? 'Active' : 'Disconnected'}
                                </strong>
                              </div>
                              <div className="channel-meta-row">
                                <span>Device Gateway:</span>
                                <strong>Baileys Web Gateway (Coexistence Mode)</strong>
                              </div>
                              {wsStatus.phone_number && (
                                <div className="channel-meta-row">
                                  <span>Webhook Delivery:</span>
                                  <strong className="text-success">Connected & Healthy</strong>
                                </div>
                              )}
                            </div>
                            <div className="channel-actions-col">
                              {wsStatus.status === 'disconnected' ? (
                                <button type="button" className="btn btn-primary" onClick={handleConnectWhatsapp} disabled={isConnecting}>
                                  {isConnecting ? <Loader className="spin" size={16} /> : 'Connect Channel'}
                                </button>
                              ) : (
                                <>
                                  <button type="button" className="btn btn-outline" onClick={handleConnectWhatsapp} disabled={isConnecting}>Reconnect</button>
                                  <button type="button" className="btn btn-danger" onClick={handleDisconnectWhatsapp}>Disconnect</button>
                                </>
                              )}
                            </div>
                          </div>

                          {(wsStatus.status === 'disconnected' || wsStatus.status === 'qr') && wsStatus.qr_code && (
                            <div className="qr-box" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <p className="instruction">Scan this QR code using WhatsApp Link a Device:</p>
                              <div className="qr-image-wrapper">
                                <img src={wsStatus.qr_code} alt="WhatsApp Web QR Code" />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="channel-health-section">
                          <h3>
                            <CheckCircle className="text-success" size={20} />
                            <span>Channel Health Status</span>
                          </h3>
                          <div className="health-grid">
                            <div className="health-card live">
                              <h4>Account Mode</h4>
                              <div className="health-status-value">{wsStatus.status === 'connected' ? 'LIVE' : 'OFFLINE'}</div>
                            </div>
                            <div className="health-card green">
                              <h4>Quality Rating</h4>
                              <div className="health-status-value">{wsStatus.status === 'connected' ? 'GREEN' : 'UNKNOWN'}</div>
                            </div>
                            <div className="health-card unconfirmed">
                              <h4>Messaging Limit</h4>
                              <div className="health-status-value">{wsStatus.status === 'connected' ? 'Unconfirmed' : 'N/A'}</div>
                            </div>
                          </div>
                        </div>

                        <button type="submit" className="btn btn-primary mt-3">Save Gateway Preference</button>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            )}

            {/* Sub-tab 2: AI Config */}
            {settingsTab === 'ai' && (
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
                        placeholder="e.g. gemini-2.0-flash, gpt-4o-mini"
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
            )}

            {/* Sub-tab 3: WooCommerce Settings */}
            {settingsTab === 'woocommerce' && (
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
            )}

            {/* Sub-tab 4: Billing & SaaS */}
            {settingsTab === 'billing' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>Choose Your Plan</h2>
                  <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>Upgrade anytime. Cancel anytime. All prices in TZS.</p>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>&#x2705;</span>
                    <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: '600' }}>Current plan: <strong style={{ color: '#059669', textTransform: 'uppercase' }}>{user.plan}</strong></span>
                  </div>
                  {user.active_until && (
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', background: '#ffffff', padding: '4px 12px', borderRadius: '20px', border: '1px solid #d1fae5' }}>
                      Valid until: <strong>{new Date(user.active_until).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                    </span>
                  )}
                </div>
                <div className="grid grid-3" style={{ gap: '20px', alignItems: 'stretch' }}>
                  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '28px 24px', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🤖</div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>JARIBIO LA BURE</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '2.4rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>0</span>
                        <span style={{ fontSize: '1rem', fontWeight: '600', color: '#6b7280' }}> TZS</span>
                        <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>/month</span>
                      </div>
                      <p style={{ fontSize: '0.825rem', color: '#6b7280' }}>Anza bila malipo yoyote</p>
                    </div>
                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '20px', marginBottom: '24px', flex: 1 }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>INAJUMUISHA</p>
                      {['1 AI Agent Connection', 'Gemini 2.0 Flash Support', 'Basic CRM & Chat Logs', 'Up to 50 Contacts', 'Basic Automations'].map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                          <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </span>
                          <span style={{ fontSize: '0.875rem', color: '#374151' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <button disabled style={{ width: '100%', padding: '11px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #e5e7eb', color: '#9ca3af', fontWeight: '600', fontSize: '0.9rem', cursor: 'not-allowed' }}>
                      {user.plan === 'free' ? '✓ Active Plan' : 'Free Plan'}
                    </button>
                  </div>
                  <div style={{ background: '#ffffff', border: '2px solid #25d366', borderRadius: '16px', padding: '28px 24px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(37, 211, 102, 0.15)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#25d366', color: '#fff', fontSize: '0.7rem', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase' }}>Most Popular</div>
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>&#x26A1;</div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em' }}>PRO AGENT</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '2.4rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>10,000</span>
                        <span style={{ fontSize: '1rem', fontWeight: '600', color: '#6b7280' }}> TZS</span>
                        <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>/month</span>
                      </div>
                      <p style={{ fontSize: '0.825rem', color: '#6b7280' }}>Kwa biashara inayokua haraka</p>
                    </div>
                    <div style={{ borderTop: '1px solid #d1fae5', paddingTop: '20px', marginBottom: '24px', flex: 1 }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>KILA KITU KWENYE FREE, PAMOJA NA:</p>
                      {['All AI Engines (Claude, OpenAI, Gemini)', 'Full Bulk Campaigns (Unlimited)', 'Advanced CRM Tags & Filters', 'Fast Agent Response Time', 'WooCommerce Integration', 'Up to 2,000 Contacts', 'Analytics Dashboard'].map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                          <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </span>
                          <span style={{ fontSize: '0.875rem', color: '#111827', fontWeight: '500' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <button style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#25d366', border: 'none', color: '#fff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
                      onClick={() => { setPayAmount(10000); setPayStatus('input'); }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1db954'}
                      onMouseLeave={e => e.currentTarget.style.background = '#25d366'}>
                      {user.plan === 'pro' ? '✓ Current Plan - Renew' : 'Subscribe (10k/mo)'}
                    </button>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '28px 24px', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>&#x1F451;</div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em' }}>ELITE ENTERPRISE</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '2.4rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>25,000</span>
                        <span style={{ fontSize: '1rem', fontWeight: '600', color: '#6b7280' }}> TZS</span>
                        <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>/month</span>
                      </div>
                      <p style={{ fontSize: '0.825rem', color: '#6b7280' }}>Kwa makampuni makubwa</p>
                    </div>
                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '20px', marginBottom: '24px', flex: 1 }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>KILA KITU KWENYE PRO, PAMOJA NA:</p>
                      {['Unlimited Contacts & History', 'High-speed Bulk Message Queuing', 'Priority Server Bandwidth', 'Dedicated Support Agent', 'Custom AI Prompt Templates', 'Multi-Agent Team Inbox', 'SLA Uptime Guarantee'].map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                          <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </span>
                          <span style={{ fontSize: '0.875rem', color: '#111827', fontWeight: '500' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <button style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#7c3aed', border: 'none', color: '#fff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
                      onClick={() => { setPayAmount(25000); setPayStatus('input'); }}
                      onMouseEnter={e => e.currentTarget.style.background = '#6d28d9'}
                      onMouseLeave={e => e.currentTarget.style.background = '#7c3aed'}>
                      {user.plan === 'premium' ? '✓ Current Plan - Renew' : 'Subscribe (25k/mo)'}
                    </button>
                  </div>
                </div>
                {(payStatus === 'input' || payStatus === 'processing' || payStatus === 'success') && (
                  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '32px', marginTop: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard size={20} color="#25d366" />
                      </div>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#111827', margin: 0 }}>Complete Subscription Payment</h2>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '24px', marginLeft: '52px' }}>
                      Upgrading to: <strong style={{ color: '#111827' }}>{payAmount === 10000 ? 'Pro Agent' : 'Elite Enterprise'}</strong>
                      <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700', marginLeft: '8px', border: '1px solid #bbf7d0' }}>{payAmount.toLocaleString()} TZS / month</span>
                    </p>
                    {payStatus === 'input' && (
                      <form onSubmit={handlePayment}>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{t.inputPaymentPhone}</label>
                          <input type="text" required placeholder="e.g. 0768222333" value={payPhone} onChange={e => setPayPhone(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', color: '#111827', background: '#fff' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: '24px' }}>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>Select Payment Provider</label>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            {[{value:'mpesa', label:'Vodacom M-Pesa', color:'#ef4444'}, {value:'tigopesa', label:'Tigo Pesa', color:'#3b82f6'}].map(p => (
                              <label key={p.value} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', border: payProvider === p.value ? '2px solid ' + p.color : '1px solid #e5e7eb', background: '#f9fafb', transition: 'all 0.2s' }}>
                                <input type="radio" name="provider" value={p.value} checked={payProvider === p.value} onChange={() => setPayProvider(p.value)} />
                                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>{p.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button type="submit" style={{ padding: '11px 28px', background: '#25d366', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}>{t.payNow}</button>
                          <button type="button" onClick={() => setPayStatus('')} style={{ padding: '11px 20px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', color: '#6b7280', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </form>
                    )}
                    {payStatus === 'processing' && (
                      <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <Loader className="spin" size={48} color="#25d366" />
                        <p style={{ color: '#374151', fontWeight: '600', fontSize: '1rem', margin: '16px 0 8px' }}>{t.paymentProcessing}</p>
                        <span style={{ fontSize: '0.8rem', color: '#9ca3af', background: '#f3f4f6', padding: '4px 12px', borderRadius: '20px' }}>Ref: {payRef}</span>
                      </div>
                    )}
                    {payStatus === 'success' && (
                      <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                          <CheckCircle size={44} color="#22c55e" />
                        </div>
                        <p style={{ color: '#111827', fontWeight: '700', fontSize: '1.1rem', marginBottom: '8px' }}>{t.paymentSuccess}</p>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '24px' }}>Plan yako imesasishwa. Furahia huduma za premium!</p>
                        <button onClick={() => setPayStatus('')} style={{ padding: '10px 28px', background: '#25d366', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Funga</button>
                      </div>
                    )}
                  </div>
                )}
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
          <div className="page-container">

            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>Campaigns</h1>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Create and manage your WhatsApp marketing campaigns</p>
              </div>
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', padding: '10px 20px', fontWeight: '700' }}
                onClick={() => { document.getElementById('create-campaign-form').scrollIntoView({ behavior: 'smooth' }); }}
              >
                <Plus size={16} /> Create Campaign
              </button>
            </div>

            {/* 5 Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '28px' }}>
              {[
                {
                  label: 'Total Campaigns',
                  value: campaigns.length,
                  sub: `${campaigns.filter(c => c.status === 'sent').length} Active`,
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                  color: '#9ca3af'
                },
                {
                  label: 'Total Recipients',
                  value: campaigns.reduce((s, c) => s + (c.sent_count || 0), 0),
                  sub: `${campaigns.reduce((s, c) => s + (c.sent_count || 0), 0)} Sent`,
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                  color: '#9ca3af'
                },
                {
                  label: 'Delivery Rate',
                  value: '0%',
                  sub: '0 Delivered',
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>,
                  valueColor: '#22c55e'
                },
                {
                  label: 'Read Rate',
                  value: '0%',
                  sub: '0 Read',
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/></svg>,
                  valueColor: '#3b82f6'
                },
                {
                  label: 'Failed Messages',
                  value: campaigns.reduce((s, c) => s + (c.failed_count || 0), 0),
                  sub: '0% Failed Rate',
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                  valueColor: campaigns.reduce((s, c) => s + (c.failed_count || 0), 0) > 0 ? '#ef4444' : '#111827'
                },
              ].map((stat, i) => (
                <div key={i} style={{
                  background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px',
                  padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: '500', marginBottom: '6px' }}>{stat.label}</p>
                      <div style={{ fontSize: '1.75rem', fontWeight: '800', color: stat.valueColor || '#111827', lineHeight: 1 }}>{stat.value}</div>
                    </div>
                    <div style={{ opacity: 0.7 }}>{stat.icon}</div>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: 0 }}>{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* All Campaigns Table */}
            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '28px' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>All Campaigns</h2>
                <p style={{ fontSize: '0.825rem', color: '#6b7280' }}>Manage and monitor your campaigns</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                {campaigns.length === 0 ? (
                  <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No campaigns found. Create your first campaign to get started.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Campaign Name', 'Target Tags', 'Status', 'Sent', 'Date', 'Actions'].map((h, i) => (
                          <th key={i} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c, i) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f9fafb' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.875rem' }}>{c.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.text}</div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#374151', background: '#f3f4f6', padding: '3px 10px', borderRadius: '20px' }}>{c.target_tags || 'All Contacts'}</span>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{
                              fontSize: '0.78rem', fontWeight: '600', padding: '4px 12px', borderRadius: '20px',
                              background: c.status === 'sent' ? '#f0fdf4' : '#fef9c3',
                              color: c.status === 'sent' ? '#16a34a' : '#ca8a04'
                            }}>{c.status === 'sent' ? 'Completed' : c.status || 'Pending'}</span>
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '0.875rem', color: '#374151', fontWeight: '600' }}>{c.sent_count || 0}</td>
                          <td style={{ padding: '14px 20px', fontSize: '0.8rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td style={{ padding: '14px 20px' }}>
                            <button style={{ fontSize: '0.78rem', padding: '5px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', color: '#374151', fontWeight: '500' }}>View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {/* Pagination bar */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.825rem', color: '#6b7280' }}>Showing 1 to {campaigns.length} of {campaigns.length} campaigns</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={{ padding: '6px 14px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', color: '#9ca3af', fontSize: '0.825rem', cursor: 'pointer' }}>Previous</button>
                  <button style={{ padding: '6px 14px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', color: '#374151', fontSize: '0.825rem', cursor: 'pointer', fontWeight: '600' }}>Next</button>
                </div>
              </div>
            </div>

            {/* Create Campaign Form */}
            <div id="create-campaign-form" style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={18} color="#22c55e" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#111827', margin: 0 }}>Create New Campaign</h2>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>Send bulk WhatsApp messages to your contacts</p>
                </div>
              </div>
              <div style={{ padding: '24px' }}>
                <form onSubmit={handleLaunchCampaign}>
                  {campMsg && <div className="alert alert-info" style={{ marginBottom: '16px' }}>{campMsg}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{t.campaignName} *</label>
                      <input type="text" required value={campForm.name}
                        onChange={e => setCampForm({ ...campForm, name: e.target.value })}
                        placeholder="e.g. Wikiendi Mlipuko Promo"
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', color: '#111827', background: '#fff', boxSizing: 'border-box' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{t.targetTags}</label>
                      <input type="text"
                        placeholder="e.g. lead, premium (leave empty = all)"
                        value={campForm.target_tags}
                        onChange={e => setCampForm({ ...campForm, target_tags: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', color: '#111827', background: '#fff', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: '0 0 20px 0' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{t.broadcastText} *</label>
                    <textarea rows={5} required
                      placeholder="Ujumbe utakaotumwa kwa wateja wako wa WhatsApp..."
                      value={campForm.text}
                      onChange={e => setCampForm({ ...campForm, text: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', color: '#111827', background: '#fff', resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>

                  {/* Template Quick-Insert */}
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', marginBottom: '10px' }}>Quick templates:</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {[
                        { label: 'Promo Offer', text: 'Habari! 🎉 Tumekuandalia ofa ya kipekee - punguzo la 20% kwa manunuzi yako yote leo. Jibu "NUNUA" kuanza mchakato.' },
                        { label: 'Reminder', text: 'Habari! ⏰ Tunakukumbusha kuhusu agizo lako. Je, una maswali yoyote? Jibu hapa na tutakusaidia.' },
                        { label: 'New Product', text: 'Habari! 🆕 Bidhaa mpya zimewasili! Tembelea duka letu leo na upate bei nzuri. Jibu "INFO" kupata maelezo zaidi.' },
                      ].map((tmpl, i) => (
                        <button key={i} type="button"
                          onClick={() => setCampForm({ ...campForm, text: tmpl.text })}
                          style={{ fontSize: '0.78rem', padding: '5px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '20px', cursor: 'pointer', color: '#374151', fontWeight: '500', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                          📝 {tmpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 24px', background: '#25d366', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}>
                      <Play size={16} /> {t.launchCampaign}
                    </button>
                    <button type="button" onClick={() => setCampForm({ name: '', target_tags: '', text: '' })}
                      style={{ padding: '11px 20px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#6b7280', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}>
                      Clear
                    </button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        )}



        {/* TAB 7: SUPER ADMIN */}
        {activeTab === 'admin' && user.role === 'admin' && (
          <div className="page-container">
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
          <div className="page-container">
            <div className="pane-header">
              <h1>{t.catalog}</h1>
              <p>Manage product items, prices, and stock status. The AI Agent will read this catalog dynamically.</p>
            </div>

            <div className="grid grid-2">
              {/* Product list grid */}
              <div className="content-card">
                <h2>All Products</h2>
                <div style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
                  {catalog.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No products in catalog. Add your first product on the right.</p>
                  ) : (
                    catalog.map(p => (
                      <div key={p.id} className="product-premium-card" style={{ padding: '20px' }}>
                        <div>
                          <div className="log-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>{p.name}</h4>
                            <span className={`badge badge-${p.status === 'available' ? 'completed' : 'failed'}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                              {p.status === 'available' ? t.available : t.outOfStock}
                            </span>
                          </div>
                          <p className="log-text" style={{ fontSize: '0.88rem', margin: '8px 0 12px 0', color: 'var(--text-secondary)' }}>
                            {p.description || 'No description provided.'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                          <span className="product-price-tag">{p.price.toLocaleString()} TZS</span>
                          <div className="button-group" style={{ display: 'flex', gap: '8px' }}>
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
                      placeholder="e.g. Sukari 1kg"
                      value={catalogForm.name}
                      onChange={e => setCatalogForm({ ...catalogForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.productPrice}</label>
                    <input 
                      type="number" 
                      required 
                      placeholder="e.g. 3000"
                      value={catalogForm.price}
                      onChange={e => setCatalogForm({ ...catalogForm, price: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.productDesc}</label>
                    <textarea 
                      rows={3} 
                      placeholder="Maelezo kuhusu bidhaa hii..."
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

                  <div className="button-group mt-3" style={{ display: 'flex', gap: '12px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Save Product</button>
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
          <div className="page-container">
            <div className="pane-header">
              <h1>{t.coupons}</h1>
              <p>Create discount promo codes. The AI Agent will read active coupons and apply discounts automatically during checkout.</p>
            </div>

            <div className="grid grid-2">
              {/* Coupons Grid */}
              <div className="content-card">
                <h2>All Coupons</h2>
                <div style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
                  {coupons.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No coupons created yet. Create your first promo code on the right.</p>
                  ) : (
                    coupons.map(c => (
                      <div key={c.id} className="coupon-ticket">
                        <div className="log-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ margin: 0, fontFamily: 'monospace', fontWeight: '800', letterSpacing: '0.05em', color: 'var(--primary)' }}>
                            {c.code}
                          </h3>
                          <span className={`badge badge-${c.active === 1 ? 'completed' : 'failed'}`}>
                            {c.active === 1 ? t.active : t.inactive}
                          </span>
                        </div>
                        <div style={{ margin: '12px 0 16px 0', fontSize: '1.2rem', fontWeight: '700', color: '#10b981' }}>
                          {c.discount_type === 'percentage' ? `${c.value}% OFF` : `-${c.value.toLocaleString()} TZS`}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                          <div className="button-group" style={{ display: 'flex', gap: '8px' }}>
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
                      placeholder="e.g. 20, 5000"
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

                  <div className="button-group mt-3" style={{ display: 'flex', gap: '12px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Save Coupon</button>
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

        {/* ===== ENTERPRISE TABS ===== */}

        {/* Analytics Dashboard */}
        {activeTab === 'analytics' && (
          <div className="page-container">
            <AnalyticsDashboard apiFetch={apiFetch} t={t} />
          </div>
        )}

        {/* Lead Scoring */}
        {activeTab === 'lead-scoring' && (
          <div className="page-container">
            <LeadScoring apiFetch={apiFetch} />
          </div>
        )}

        {/* Order Management */}
        {activeTab === 'orders' && (
          <div className="page-container">
            <OrderManager apiFetch={apiFetch} />
          </div>
        )}

        {/* Scheduled Messages */}
        {activeTab === 'scheduled' && (
          <div className="page-container">
            <ScheduledMessages apiFetch={apiFetch} />
          </div>
        )}

        {/* Contact Segments */}
        {activeTab === 'segments' && (
          <div className="page-container">
            <ContactSegments apiFetch={apiFetch} />
          </div>
        )}

        {/* Quick Reply Templates */}
        {activeTab === 'templates' && (
          <div className="page-container">
            <QuickReplies apiFetch={apiFetch} />
          </div>
        )}

        {/* Team Inbox */}
        {activeTab === 'team' && (
          <div className="page-container">
            <TeamInbox apiFetch={apiFetch} />
          </div>
        )}

        {/* Webhooks & API */}
        {activeTab === 'webhooks' && (
          <div className="page-container">
            <WebhookManager apiFetch={apiFetch} user={user} />
          </div>
        )}

        {/* A/B Testing */}
        {activeTab === 'abtesting' && (
          <div className="page-container">
            <ABTesting apiFetch={apiFetch} />
          </div>
        )}

        {/* Compliance & Opt-Out */}
        {activeTab === 'compliance' && (
          <div className="page-container">
            <ComplianceManager apiFetch={apiFetch} />
          </div>
        )}

      </main>
    </div>
  );
}
