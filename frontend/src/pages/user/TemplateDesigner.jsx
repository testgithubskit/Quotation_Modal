import { useEffect, useState } from 'react';
import {
  Typography, Button, List, Space, Tag, Input, Switch, ColorPicker, message, Popconfirm, Row, Col,
} from 'antd';
import { PlusOutlined, SaveOutlined, DeleteOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import ReportDocument from '../../components/ReportDocument';

const SAMPLE_REPORT = {
  reportNo: 'QR-0001',
  date: '31-08-2026',
  center: 'Davangere Center',
  lab: 'Civil Engineering Lab',
  customer: { name: 'Arvind Rao', company: 'Rao Builders & Developers', address: 'Gandhi Road, Davangere', email: 'arvind@raobuilders.in', mobile: '9900112233' },
  activities: [
    { key: 's1', code: 'ACT-101', specification: 'Compressive Strength Test', particulars: 'Concrete cube testing, 150mm', cost: 450, qty: 3, subActivities: [
      { key: 's1a', code: 'ACT-101A', specification: '7-day curing', particulars: 'Early strength check', cost: 150, qty: 3 },
    ] },
    { key: 's2', code: 'ACT-104', specification: 'Steel Tensile Test', particulars: 'Reinforcement bar, UTM', cost: 600, qty: 2, subActivities: [] },
  ],
};

function blankTemplate() {
  return {
    name: 'New Template',
    companyName: 'Your Company Name',
    companyAddress: 'Company address, city, state',
    logo: null,
    primaryColor: '#16324F',
    headerText: 'QUOTATION REPORT',
    footerText: 'This is a computer-generated document and does not require a signature.',
    showLogo: true,
    align: 'left',
    fontFamily: "Inter, sans-serif",
  };
}

export default function TemplateDesigner() {
  const { data, refreshTemplates, addTemplate, updateTemplate, deleteTemplate } = useData();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(blankTemplate());
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    refreshTemplates()
      .then(() => {})
      .catch(() => {});
  }, [refreshTemplates]);

  useEffect(() => {
    if (!selectedId && !isNew && data.templates[0]) {
      setSelectedId(data.templates[0].id);
      setDraft(data.templates[0]);
    }
  }, [data.templates, selectedId, isNew]);

  const selectTemplate = (t) => {
    setSelectedId(t.id);
    setDraft(t);
    setIsNew(false);
  };

  const startNew = () => {
    setSelectedId(null);
    setDraft(blankTemplate());
    setIsNew(true);
  };

  const patch = (p) => setDraft((d) => ({ ...d, ...p }));

  const handleSave = async () => {
    if (!draft.name?.trim()) { message.error('Give the template a name'); return; }
    try {
      if (isNew) {
        await addTemplate(draft);
        message.success('Template created');
      } else {
        await updateTemplate(selectedId, draft);
        message.success('Template saved');
      }
      setIsNew(false);
    } catch (error) {
      message.error(error?.response?.data?.error?.detail || 'Failed to save template');
    }
  };

  const setDefault = async (id) => {
    try {
      await Promise.all(
        data.templates.map((t) => updateTemplate(t.id, { ...t, isDefault: t.id === id })),
      );
      message.success('Default template updated');
    } catch (error) {
      message.error(error?.response?.data?.error?.detail || 'Failed to update default');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <p className="section-eyebrow">User</p>
          <Typography.Title level={3} className="page-title" style={{ margin: 0 }}>Design Template</Typography.Title>
          <Typography.Text type="secondary">Create a reusable layout for your quotation reports</Typography.Text>
        </div>
        <Space>
          <Button onClick={() => navigate('/user/reports')}>Back to Reports</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={startNew}>New Template</Button>
        </Space>
      </div>

      <Row gutter={20}>
        <Col span={6}>
          <div className="card-shell" style={{ padding: 8 }}>
            <List
              dataSource={data.templates}
              renderItem={(t) => (
                <List.Item
                  onClick={() => selectTemplate(t)}
                  style={{
                    cursor: 'pointer', borderRadius: 4, padding: '10px 12px',
                    background: selectedId === t.id && !isNew ? '#F1EEE6' : 'transparent',
                  }}
                  actions={[
                    <Button
                      key="default" type="text" size="small"
                      icon={t.isDefault ? <StarFilled style={{ color: '#B8863A' }} /> : <StarOutlined />}
                      onClick={(e) => { e.stopPropagation(); setDefault(t.id); }}
                    />,
                    <Popconfirm
                      key="del"
                      title="Delete template?"
                      onConfirm={async (e) => {
                        e?.stopPropagation?.();
                        try {
                          await deleteTemplate(t.id);
                          message.success('Template deleted');
                          if (selectedId === t.id) startNew();
                        } catch (error) {
                          message.error(error?.response?.data?.error?.detail || 'Failed to delete');
                        }
                      }}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={<span style={{ fontSize: 13.5 }}>{t.name}</span>}
                    description={t.isDefault ? <Tag color="#16324F">Default</Tag> : null}
                  />
                </List.Item>
              )}
            />
          </div>
        </Col>

        <Col span={7}>
          <div className="card-shell" style={{ padding: 20 }}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>{isNew ? 'New Template' : 'Template Settings'}</Typography.Title>

            <Field label="Template name">
              <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Company name">
              <Input value={draft.companyName} onChange={(e) => patch({ companyName: e.target.value })} />
            </Field>
            <Field label="Company address">
              <Input.TextArea rows={2} value={draft.companyAddress} onChange={(e) => patch({ companyAddress: e.target.value })} />
            </Field>
            <Field label="Report title">
              <Input value={draft.headerText} onChange={(e) => patch({ headerText: e.target.value })} />
            </Field>
            <Field label="Footer note">
              <Input.TextArea rows={2} value={draft.footerText} onChange={(e) => patch({ footerText: e.target.value })} />
            </Field>
            <Row gutter={12}>
              <Col span={12}>
                <Field label="Accent color">
                  <ColorPicker value={draft.primaryColor} onChangeComplete={(c) => patch({ primaryColor: c.toHexString() })} showText />
                </Field>
              </Col>
              <Col span={12}>
                <Field label="Show logo">
                  <Switch checked={draft.showLogo !== false} onChange={(v) => patch({ showLogo: v })} />
                </Field>
              </Col>
            </Row>

            <Button type="primary" icon={<SaveOutlined />} block onClick={handleSave} style={{ marginTop: 8 }}>
              {isNew ? 'Create Template' : 'Save Changes'}
            </Button>
          </div>
        </Col>

        <Col span={11}>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Preview (click the logo area on the preview to upload one)
          </Typography.Text>
          <div style={{ background: '#EFEBE1', padding: '24px 0', borderRadius: 6, transform: 'scale(0.72)', transformOrigin: 'top center', marginBottom: -280 }}>
            <ReportDocument report={SAMPLE_REPORT} template={draft} editable onTemplateChange={patch} />
          </div>
        </Col>
      </Row>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 4 }}>{label}</Typography.Text>
      {children}
    </div>
  );
}
