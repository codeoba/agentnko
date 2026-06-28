import React, { useState, useEffect } from 'react';
import { Target, RefreshCw, TrendingUp, Star, AlertTriangle, Flame } from 'lucide-react';

const SCORE_GRADES = {
  hot: { min: 80, label: 'Hot 🔥', cls: 'grade-hot', color: '#ef4444' },
  warm: { min: 60, label: 'Warm 🌡️', cls: 'grade-warm', color: '#f97316' },
  medium: { min: 40, label: 'Medium 📊', cls: 'grade-medium', color: '#eab308' },
  cool: { min: 20, label: 'Cool 🌊', cls: 'grade-cool', color: '#3b82f6' },
  cold: { min: 0, label: 'Cold ❄️', cls: 'grade-cold', color: '#6b7280' },
};

function getGrade(score) {
  if (score >= 80) return SCORE_GRADES.hot;
  if (score >= 60) return SCORE_GRADES.warm;
  if (score >= 40) return SCORE_GRADES.medium;
  if (score >= 20) return SCORE_GRADES.cool;
  return SCORE_GRADES.cold;
}

export default function LeadScoring({ apiFetch }) {
  const [leads, setLeads] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/lead-scores/top?limit=50');
      setLeads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      await apiFetch('/api/lead-scores/recalculate', { method: 'POST' });
      await loadLeads();
    } catch (err) {
      console.error(err);
    } finally {
      setRecalculating(false);
    }
  }

  async function loadHistory(contactId) {
    try {
      const data = await apiFetch(`/api/lead-scores/history/${contactId}`);
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSelectLead(lead) {
    setSelectedLead(lead);
    await loadHistory(lead.id);
  }

  const filteredLeads = leads.filter(lead => {
    if (filter === 'all') return true;
    if (filter === 'hot') return lead.lead_score >= 80;
    if (filter === 'warm') return lead.lead_score >= 60 && lead.lead_score < 80;
    if (filter === 'cold') return lead.lead_score < 40;
    return true;
  });

  const hotCount = leads.filter(l => l.lead_score >= 80).length;
  const warmCount = leads.filter(l => l.lead_score >= 60 && l.lead_score < 80).length;

  return (
    <div className="lead-scoring">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title"><Target size={22} /> AI Lead Scoring</h2>
          <p className="section-subtitle">Contacts wamepangwa kwa nia ya kununua</p>
        </div>
        <button className="btn-primary" onClick={handleRecalculate} disabled={recalculating}>
          <RefreshCw size={16} className={recalculating ? 'spin' : ''} />
          {recalculating ? 'Inachambua...' : 'Hesabu Upya'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="lead-summary-grid">
        <div className="lead-summary-card hot">
          <Flame size={24} />
          <div>
            <div className="lead-summary-num">{hotCount}</div>
            <div className="lead-summary-label">Leads za Hot 🔥</div>
          </div>
        </div>
        <div className="lead-summary-card warm">
          <TrendingUp size={24} />
          <div>
            <div className="lead-summary-num">{warmCount}</div>
            <div className="lead-summary-label">Leads za Warm 🌡️</div>
          </div>
        </div>
        <div className="lead-summary-card total">
          <Star size={24} />
          <div>
            <div className="lead-summary-num">{leads.length}</div>
            <div className="lead-summary-label">Contacts Wote</div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="lead-filter-tabs">
        {['all', 'hot', 'warm', 'cold'].map(f => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Wote' : f === 'hot' ? '🔥 Hot' : f === 'warm' ? '🌡️ Warm' : '❄️ Cold'}
          </button>
        ))}
      </div>

      <div className="lead-content-grid">
        {/* Leads List */}
        <div className="leads-list-panel">
          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : filteredLeads.length === 0 ? (
            <div className="empty-state">
              <Target size={40} />
              <p>Hakuna leads katika kundi hili</p>
            </div>
          ) : (
            filteredLeads.map(lead => {
              const grade = getGrade(lead.lead_score || 0);
              return (
                <div
                  key={lead.id}
                  className={`lead-card ${selectedLead?.id === lead.id ? 'selected' : ''}`}
                  onClick={() => handleSelectLead(lead)}
                >
                  <div className="lead-card-avatar" style={{ backgroundColor: grade.color }}>
                    {(lead.name || lead.phone_number)[0].toUpperCase()}
                  </div>
                  <div className="lead-card-info">
                    <div className="lead-card-name">{lead.name || lead.phone_number}</div>
                    <div className="lead-card-phone">{lead.phone_number}</div>
                    {lead.tags && <div className="lead-card-tags">{lead.tags}</div>}
                  </div>
                  <div className="lead-card-score">
                    <div className="score-circle" style={{ borderColor: grade.color, color: grade.color }}>
                      {lead.lead_score || 0}
                    </div>
                    <div className={`score-grade ${grade.cls}`}>{grade.label}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Lead Detail Panel */}
        <div className="lead-detail-panel">
          {selectedLead ? (
            <>
              <div className="lead-detail-header">
                <div className="lead-detail-avatar" style={{ backgroundColor: getGrade(selectedLead.lead_score || 0).color }}>
                  {(selectedLead.name || selectedLead.phone_number)[0].toUpperCase()}
                </div>
                <div>
                  <h3>{selectedLead.name || 'Haijulikani'}</h3>
                  <p>{selectedLead.phone_number}</p>
                </div>
              </div>

              {/* Score Meter */}
              <div className="score-meter-section">
                <div className="score-meter-label">
                  <span>Lead Score</span>
                  <span className="score-big" style={{ color: getGrade(selectedLead.lead_score || 0).color }}>
                    {selectedLead.lead_score || 0}/100
                  </span>
                </div>
                <div className="score-meter-bar">
                  <div
                    className="score-meter-fill"
                    style={{
                      width: `${selectedLead.lead_score || 0}%`,
                      backgroundColor: getGrade(selectedLead.lead_score || 0).color
                    }}
                  />
                </div>
                <div className="score-grade-badge" style={{ backgroundColor: getGrade(selectedLead.lead_score || 0).color }}>
                  {getGrade(selectedLead.lead_score || 0).label}
                </div>
              </div>

              {/* Contact Details */}
              <div className="lead-detail-info">
                <div className="detail-row">
                  <span>Messages</span>
                  <strong>{selectedLead.message_count || 0}</strong>
                </div>
                <div className="detail-row">
                  <span>Mara ya Mwisho</span>
                  <strong>{selectedLead.last_seen ? new Date(selectedLead.last_seen).toLocaleDateString('sw-TZ') : 'Haijulikani'}</strong>
                </div>
                <div className="detail-row">
                  <span>Tags</span>
                  <strong>{selectedLead.tags || 'Hakuna'}</strong>
                </div>
                <div className="detail-row">
                  <span>AI</span>
                  <strong>{selectedLead.ai_disabled ? '❌ Imezimwa' : '✅ Imewashwa'}</strong>
                </div>
              </div>

              {/* Score History */}
              {history.length > 0 && (
                <div className="score-history">
                  <h4>Historia ya Score</h4>
                  {history.map((h, i) => (
                    <div key={i} className="history-row">
                      <span className="history-score" style={{ color: getGrade(h.score).color }}>{h.score}</span>
                      <span className="history-reason">{h.reason}</span>
                      <span className="history-date">{new Date(h.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <AlertTriangle size={40} />
              <p>Chagua contact kuona maelezo ya score</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
