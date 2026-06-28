import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Search, Copy, Check } from 'lucide-react';

const CATEGORIES = [
  { value: 'all', label: 'Zote' },
  { value: 'greetings', label: '👋 Salamu' },
  { value: 'pricing', label: '💰 Bei' },
  { value: 'orders', label: '📦 Orders' },
  { value: 'payments', label: '💳 Malipo' },
  { value: 'products', label: '🛍️ Bidhaa' },
  { value: 'support', label: '🛠️ Msaada' },
  { value: 'general', label: '📝 Mengine' },
];

export default function QuickReplies({ apiFetch }) {
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState({
    id: null, name: '', shortcut: '', content: '', category: 'general'
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/templates');
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ id: null, name: '', shortcut: '', content: '', category: 'general' });
      await loadTemplates();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Futa template hii?')) return;
    try {
      await apiFetch(`/api/templates/${id}`, { method: 'DELETE' });
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  function handleEdit(template) {
    setForm({ ...template });
    setShowForm(true);
  }

  function handleCopy(template) {
    navigator.clipboard.writeText(template.content);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleShortcutChange(val) {
    // Auto-prefix with /
    let shortcut = val;
    if (val && !val.startsWith('/')) shortcut = '/' + val;
    setForm({ ...form, shortcut: shortcut.toLowerCase().replace(/\s+/g, '') });
  }

  const filtered = templates.filter(t => {
    const matchCat = activeCategory === 'all' || t.category === activeCategory;
    const matchSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="quick-replies">
      <div className="section-header">
        <div>
          <h2 className="section-title"><FileText size={22} /> Quick Reply Templates</h2>
          <p className="section-subtitle">Jibu haraka na templates zako ({templates.length} templates)</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setForm({ id: null, name: '', shortcut: '', content: '', category: 'general' }); }}>
          <Plus size={16} /> Template Mpya
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="template-form-card">
          <h3>{form.id ? '✏️ Hariri Template' : '➕ Template Mpya'}</h3>
          <form onSubmit={handleSave}>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Jina la Template</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Mfano: Salamu ya Kwanza"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Shortcut (/amri)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="/salamu"
                  value={form.shortcut}
                  onChange={e => handleShortcutChange(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Kategoria</label>
                <select
                  className="form-input"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Maudhui ya Template</label>
              <textarea
                className="form-input"
                rows={5}
                placeholder="Andika ujumbe wa template hapa..."
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                required
              />
              <div className="char-count">{form.content.length} herufi</div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Ghairi</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Inahifadhi...' : form.id ? 'Hifadhi' : 'Unda Template'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter */}
      <div className="templates-toolbar">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Tafuta template..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="category-tabs">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              className={`category-tab ${activeCategory === c.value ? 'active' : ''}`}
              onClick={() => setActiveCategory(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>Hakuna templates</h3>
          <p>Unda template ya kwanza au badilisha filter</p>
        </div>
      ) : (
        <div className="templates-grid">
          {filtered.map(t => (
            <div key={t.id} className="template-card">
              <div className="template-card-header">
                <div className="template-header-left">
                  <span className="template-shortcut">{t.shortcut}</span>
                  <span className="template-name">{t.name}</span>
                </div>
                <span className={`template-category-badge cat-${t.category}`}>
                  {CATEGORIES.find(c => c.value === t.category)?.label || t.category}
                </span>
              </div>
              <div className="template-content">{t.content}</div>
              <div className="template-card-footer">
                <span className="template-usage">{t.usage_count || 0}x imetumika</span>
                <div className="template-actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleCopy(t)}
                    title="Nakili"
                  >
                    {copiedId === t.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button className="btn-icon" onClick={() => handleEdit(t)} title="Hariri">
                    ✏️
                  </button>
                  <button className="btn-icon danger" onClick={() => handleDelete(t.id)} title="Futa">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
