import React, { useState, useEffect } from 'react';
import { Zap, Plus, Trash2, Users, Filter, ChevronRight, RefreshCw } from 'lucide-react';

const FILTER_FIELDS = [
  { value: 'tags', label: 'Tags' },
  { value: 'lead_score_gte', label: 'Lead Score ≥' },
  { value: 'lead_score_lte', label: 'Lead Score ≤' },
  { value: 'inactive_days', label: 'Hawajatuma kwa siku' },
  { value: 'active_days', label: 'Walituma ndani ya siku' },
  { value: 'message_count_gte', label: 'Idadi ya messages ≥' },
];

export default function ContactSegments({ apiFetch }) {
  const [segments, setSegments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [segContacts, setSegContacts] = useState([]);
  const [selectedSeg, setSelectedSeg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: null, name: '', description: '',
    filter_rules: []
  });

  useEffect(() => {
    loadSegments();
  }, []);

  async function loadSegments() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/segments');
      setSegments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function addRule() {
    setForm(f => ({
      ...f,
      filter_rules: [...f.filter_rules, { field: 'tags', value: '' }]
    }));
  }

  function updateRule(i, key, val) {
    setForm(f => {
      const rules = [...f.filter_rules];
      rules[i] = { ...rules[i], [key]: val };
      return { ...f, filter_rules: rules };
    });
  }

  function removeRule(i) {
    setForm(f => ({ ...f, filter_rules: f.filter_rules.filter((_, idx) => idx !== i) }));
  }

  async function handlePreview() {
    setPreviewing(true);
    try {
      // Create temp segment to preview
      const data = await apiFetch('/api/segments', {
        method: 'POST',
        body: JSON.stringify({ ...form, name: form.name || '__preview__' }),
      });
      // Fetch contacts for last segment (or use preview count)
      setSegContacts([]);
    } catch (err) {
      alert(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/segments', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ id: null, name: '', description: '', filter_rules: [] });
      await loadSegments();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadSegmentContacts(seg) {
    setSelectedSeg(seg);
    try {
      const data = await apiFetch(`/api/segments/${seg.id}/contacts`);
      setSegContacts(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Futa segment hii?')) return;
    try {
      await apiFetch(`/api/segments/${id}`, { method: 'DELETE' });
      setSegments(segments.filter(s => s.id !== id));
      if (selectedSeg?.id === id) { setSelectedSeg(null); setSegContacts([]); }
    } catch (err) {
      alert(err.message);
    }
  }

  function editSegment(seg) {
    setForm({
      id: seg.id,
      name: seg.name,
      description: seg.description || '',
      filter_rules: JSON.parse(seg.filter_rules || '[]'),
    });
    setShowForm(true);
  }

  return (
    <div className="contact-segments">
      <div className="section-header">
        <div>
          <h2 className="section-title"><Filter size={22} /> Contact Segments</h2>
          <p className="section-subtitle">Gawanya contacts kwa vikundi vya akili</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setForm({ id: null, name: '', description: '', filter_rules: [] }); }}>
          <Plus size={16} /> Segment Mpya
        </button>
      </div>

      {/* Segment Form */}
      {showForm && (
        <div className="segment-form-card">
          <h3>{form.id ? '✏️ Hariri Segment' : '➕ Segment Mpya'}</h3>
          <form onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Jina la Segment</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Mfano: Wateja VIP"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Maelezo (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Maelezo mafupi"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            <div className="filter-rules-section">
              <div className="filter-rules-header">
                <span>Masharti ya Kuchagua Contacts</span>
                <button type="button" className="btn-small" onClick={addRule}>
                  <Plus size={14} /> Ongeza Sharti
                </button>
              </div>

              {form.filter_rules.length === 0 ? (
                <div className="filter-empty">Bonyeza "Ongeza Sharti" kuanza. Bila masharti, segment itachukua contacts wote.</div>
              ) : (
                form.filter_rules.map((rule, i) => (
                  <div key={i} className="filter-rule-row">
                    <select
                      className="form-input filter-field-select"
                      value={rule.field}
                      onChange={e => updateRule(i, 'field', e.target.value)}
                    >
                      {FILTER_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="form-input filter-value-input"
                      placeholder={
                        rule.field === 'tags' ? 'Mfano: vip' :
                        rule.field.includes('score') ? '0-100' :
                        rule.field.includes('days') ? 'Idadi ya siku' : 'Thamani'
                      }
                      value={rule.value}
                      onChange={e => updateRule(i, 'value', e.target.value)}
                    />
                    <button type="button" className="btn-icon danger" onClick={() => removeRule(i)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Ghairi</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Inahifadhi...' : form.id ? 'Hifadhi Mabadiliko' : 'Unda Segment'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="segments-content-grid">
        {/* Segments List */}
        <div className="segments-list">
          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : segments.length === 0 ? (
            <div className="empty-state">
              <Users size={40} />
              <p>Hakuna segments. Unda segment ya kwanza.</p>
            </div>
          ) : (
            segments.map(seg => (
              <div
                key={seg.id}
                className={`segment-item ${selectedSeg?.id === seg.id ? 'selected' : ''}`}
                onClick={() => loadSegmentContacts(seg)}
              >
                <div className="segment-item-icon">
                  <Zap size={18} />
                </div>
                <div className="segment-item-info">
                  <div className="segment-item-name">{seg.name}</div>
                  <div className="segment-item-desc">{seg.description || 'Hakuna maelezo'}</div>
                  <div className="segment-item-meta">
                    <span className="segment-count-badge">{seg.contact_count || 0} contacts</span>
                    <span className="segment-rules-count">{JSON.parse(seg.filter_rules || '[]').length} masharti</span>
                  </div>
                </div>
                <div className="segment-item-actions">
                  <button className="btn-icon" onClick={e => { e.stopPropagation(); editSegment(seg); }} title="Hariri">
                    ✏️
                  </button>
                  <button className="btn-icon danger" onClick={e => { e.stopPropagation(); handleDelete(seg.id); }} title="Futa">
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} className="segment-arrow" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Contacts Preview */}
        <div className="segment-contacts-panel">
          {selectedSeg ? (
            <>
              <div className="seg-contacts-header">
                <h3>👥 Contacts katika "{selectedSeg.name}"</h3>
                <span className="badge badge-blue">{segContacts.length} contacts</span>
              </div>
              <div className="seg-contacts-list">
                {segContacts.map(c => (
                  <div key={c.id} className="seg-contact-row">
                    <div className="seg-contact-avatar">
                      {(c.name || c.phone_number)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="seg-contact-name">{c.name || 'Haijulikani'}</div>
                      <div className="seg-contact-phone">{c.phone_number}</div>
                    </div>
                    <div className="seg-contact-score" title={`Lead Score: ${c.lead_score}`}>
                      {c.lead_score || 0}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Filter size={40} />
              <p>Chagua segment kuona contacts wake</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
