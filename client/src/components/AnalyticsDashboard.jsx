import React, { useState, useEffect } from 'react';
import {
  Calendar, Upload, MessageSquare, CheckCircle2, Eye, Reply, XCircle, Database
} from 'lucide-react';

export default function AnalyticsDashboard({ apiFetch, t }) {
  const [timeRange, setTimeRange] = useState('30 Days');
  const [activeTab, setActiveTab] = useState('Overview');

  // Dummy stats simulating the UI, later hook this to actual API.
  const stats = {
    totalMessages: 0,
    deliveryRate: '0.0%',
    readRate: '0.0%',
    replyRate: '0.0%',
    failureRate: '0.0%',
    summary: {
      activeCampaigns: 0,
      totalCampaigns: 0,
      uniqueContacts: 0,
      totalRecipients: 0
    }
  };

  return (
    <div style={{ padding: '0', background: 'transparent', minHeight: '100%', fontFamily: '"Inter", "Segoe UI", sans-serif' }}>
      
      {/* 1. Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>Analytics & Reports</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Track your WhatsApp business performance with real-time data</p>
      </div>

      {/* 2. Filters Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: '#ffffff', padding: '16px 24px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontWeight: '500', fontSize: '0.9rem' }}>
            <Calendar size={18} />
            <span>Time Range:</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['7 Days', '30 Days', '3 Months'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '8px 16px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer',
                  border: timeRange === range ? 'none' : '1px solid #e5e7eb',
                  borderRadius: '6px',
                  background: timeRange === range ? '#16a34a' : '#ffffff',
                  color: timeRange === range ? '#ffffff' : '#374151',
                  transition: 'all 0.2s ease'
                }}
              >
                {range}
              </button>
            ))}
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem', fontWeight: '500', cursor: 'pointer', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#ffffff', color: '#374151' }}>
              <Calendar size={14} /> Custom
            </button>
          </div>
        </div>
        
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#ffffff', color: '#374151', transition: 'all 0.2s ease' }}>
          <Upload size={16} color="#6b7280" /> Export
        </button>
      </div>

      {/* 3. Tab Selector */}
      <div style={{ background: '#f3f4f6', padding: '6px', borderRadius: '10px', display: 'flex', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
        {['Overview', 'Messages', 'Campaigns'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '10px', fontSize: '0.9rem', fontWeight: activeTab === tab ? '600' : '500', cursor: 'pointer',
              border: 'none', borderRadius: '6px',
              background: activeTab === tab ? '#ffffff' : 'transparent',
              color: activeTab === tab ? '#111827' : '#6b7280',
              boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 4. 5 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* Total Messages */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Total Messages</p>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{stats.totalMessages}</h3>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={20} color="#3b82f6" />
            </div>
          </div>
          <p style={{ margin: '16px 0 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Last 30 days</p>
        </div>

        {/* Delivery Rate */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Delivery Rate</p>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#16a34a' }}>{stats.deliveryRate}</h3>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} color="#16a34a" />
            </div>
          </div>
          <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', marginTop: '16px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '0%', background: '#16a34a', borderRadius: '3px' }}></div>
          </div>
        </div>

        {/* Read Rate */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Read Rate</p>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#f97316' }}>{stats.readRate}</h3>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={20} color="#f97316" />
            </div>
          </div>
          <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', marginTop: '16px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '0%', background: '#f97316', borderRadius: '3px' }}></div>
          </div>
        </div>

        {/* Reply Rate */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Reply Rate</p>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#8b5cf6' }}>{stats.replyRate}</h3>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Reply size={20} color="#8b5cf6" />
            </div>
          </div>
          <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', marginTop: '16px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '0%', background: '#8b5cf6', borderRadius: '3px' }}></div>
          </div>
        </div>

        {/* Failure Rate */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Failure Rate</p>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#ef4444' }}>{stats.failureRate}</h3>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={20} color="#ef4444" />
            </div>
          </div>
          <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', marginTop: '16px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '0%', background: '#ef4444', borderRadius: '3px' }}></div>
          </div>
        </div>
      </div>

      {/* 5. Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Message Performance */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>Message Performance</h3>
          
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Database size={28} color="#9ca3af" />
            </div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: '600', color: '#111827' }}>Message Performance</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>No data available</p>
          </div>
        </div>

        {/* Summary */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>Summary</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: '500' }}>Active Campaigns</span>
              <span style={{ fontSize: '0.95rem', color: '#111827', fontWeight: '600' }}>{stats.summary.activeCampaigns}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: '500' }}>Total Campaigns</span>
              <span style={{ fontSize: '0.95rem', color: '#111827', fontWeight: '600' }}>{stats.summary.totalCampaigns}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: '500' }}>Unique Contacts</span>
              <span style={{ fontSize: '0.95rem', color: '#111827', fontWeight: '600' }}>{stats.summary.uniqueContacts}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: '500' }}>Total Recipients</span>
              <span style={{ fontSize: '0.95rem', color: '#111827', fontWeight: '600' }}>{stats.summary.totalRecipients}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
