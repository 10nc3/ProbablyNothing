const crypto = require('crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} = require('discord.js');

const COMPONENT_ID_PREFIX = 'oc:';
const MODAL_ID_PREFIX = 'ocm:';
const MAX_BUTTONS_PER_ROW = 5;
const MAX_MODAL_FIELDS = 5;
const REGISTRY_TTL_MS = 15 * 60 * 1000;
const REGISTRY_MAX_SIZE = 500;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const _registry = new Map();

function _createId(prefix) {
  return `${prefix}${crypto.randomBytes(6).toString('base64url')}`;
}

function _cleanup() {
  const now = Date.now();
  for (const [id, entry] of _registry) {
    if (entry.expiresAt && now > entry.expiresAt) {
      _registry.delete(id);
    }
  }
}

setInterval(_cleanup, CLEANUP_INTERVAL_MS).unref();

function _evictOldest() {
  if (_registry.size <= REGISTRY_MAX_SIZE) return;
  let oldestId = null;
  let oldestTime = Infinity;
  for (const [id, entry] of _registry) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestId = id;
    }
  }
  if (oldestId) _registry.delete(oldestId);
}

function registerComponent(entry) {
  _evictOldest();
  const now = Date.now();
  _registry.set(entry.id, {
    ...entry,
    createdAt: now,
    expiresAt: now + REGISTRY_TTL_MS,
  });
}

function consumeComponent(customId) {
  const entry = _registry.get(customId);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    _registry.delete(customId);
    return null;
  }
  _registry.delete(customId);
  return entry;
}

function peekComponent(customId) {
  const entry = _registry.get(customId);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    _registry.delete(customId);
    return null;
  }
  return entry;
}

function consumeModal(customId) {
  const entry = _registry.get(customId);
  if (!entry || entry.kind !== 'modal') return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    _registry.delete(customId);
    return null;
  }
  _registry.delete(customId);
  return entry;
}

function _mapButtonStyle(style) {
  switch ((style || 'primary').toLowerCase()) {
    case 'secondary': return ButtonStyle.Secondary;
    case 'success': return ButtonStyle.Success;
    case 'danger': return ButtonStyle.Danger;
    case 'link': return ButtonStyle.Link;
    case 'primary':
    default: return ButtonStyle.Primary;
  }
}

function buildButtonRow(buttons, meta = {}) {
  const row = new ActionRowBuilder();
  const entries = [];

  for (const btn of buttons.slice(0, MAX_BUTTONS_PER_ROW)) {
    const isLink = btn.style === 'link' && btn.url;

    if (isLink) {
      const b = new ButtonBuilder()
        .setLabel(btn.label)
        .setStyle(ButtonStyle.Link)
        .setURL(btn.url);
      if (btn.disabled) b.setDisabled(true);
      row.addComponents(b);
    } else {
      const customId = _createId(COMPONENT_ID_PREFIX);
      const b = new ButtonBuilder()
        .setLabel(btn.label)
        .setStyle(_mapButtonStyle(btn.style))
        .setCustomId(customId);
      if (btn.disabled) b.setDisabled(true);

      const entry = {
        id: customId,
        kind: 'button',
        label: btn.label,
        ...meta,
      };
      entries.push(entry);
      registerComponent(entry);
      row.addComponents(b);
    }
  }

  return { row, entries };
}

function buildSelectRow(spec, meta = {}) {
  const customId = _createId(COMPONENT_ID_PREFIX);
  const type = (spec.type || 'string').toLowerCase();
  let menu;

  if (type === 'string') {
    menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(spec.placeholder || 'Select an option');
    if (spec.options && spec.options.length > 0) {
      menu.addOptions(spec.options.map(o => ({
        label: o.label,
        value: o.value,
        description: o.description || undefined,
        default: o.default || false,
      })));
    }
    if (spec.minValues != null) menu.setMinValues(spec.minValues);
    if (spec.maxValues != null) menu.setMaxValues(spec.maxValues);
  } else if (type === 'user') {
    menu = new UserSelectMenuBuilder().setCustomId(customId);
    if (spec.placeholder) menu.setPlaceholder(spec.placeholder);
  } else if (type === 'role') {
    menu = new RoleSelectMenuBuilder().setCustomId(customId);
    if (spec.placeholder) menu.setPlaceholder(spec.placeholder);
  } else if (type === 'mentionable') {
    menu = new MentionableSelectMenuBuilder().setCustomId(customId);
    if (spec.placeholder) menu.setPlaceholder(spec.placeholder);
  } else if (type === 'channel') {
    menu = new ChannelSelectMenuBuilder().setCustomId(customId);
    if (spec.placeholder) menu.setPlaceholder(spec.placeholder);
  } else {
    menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(spec.placeholder || 'Select an option');
  }

  const row = new ActionRowBuilder().addComponents(menu);

  const entry = {
    id: customId,
    kind: 'select',
    selectType: type,
    label: spec.placeholder || 'select',
    options: (spec.options || []).map(o => ({ value: o.value, label: o.label })),
    ...meta,
  };
  registerComponent(entry);

  return { row, entry };
}

function buildModal(spec, triggerId, meta = {}) {
  const modalId = _createId(MODAL_ID_PREFIX);
  const modal = new ModalBuilder()
    .setCustomId(modalId)
    .setTitle(spec.title || 'Form');

  const fieldDefs = [];

  for (const field of (spec.fields || []).slice(0, MAX_MODAL_FIELDS)) {
    const fieldId = _createId('f:');
    const style = field.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short;

    const input = new TextInputBuilder()
      .setCustomId(fieldId)
      .setLabel(field.label || 'Field')
      .setStyle(style)
      .setRequired(field.required !== false);

    if (field.placeholder) input.setPlaceholder(field.placeholder);
    if (field.minLength != null) input.setMinLength(field.minLength);
    if (field.maxLength != null) input.setMaxLength(field.maxLength);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    fieldDefs.push({
      id: fieldId,
      name: field.name || field.label || `field_${fieldDefs.length + 1}`,
      label: field.label,
      type: field.type || 'text',
    });
  }

  const modalEntry = {
    id: modalId,
    kind: 'modal',
    title: spec.title,
    fields: fieldDefs,
    triggerId,
    modal,
    ...meta,
  };
  registerComponent(modalEntry);

  return { modal, modalEntry };
}

function buildComponentSpec(spec, meta = {}) {
  if (!spec || typeof spec !== 'object') return null;

  const components = [];
  const allEntries = [];
  let modalData = null;

  if (spec.blocks && Array.isArray(spec.blocks)) {
    for (const block of spec.blocks) {
      if (!block || !block.type) continue;

      if (block.type === 'actions') {
        if (block.buttons && Array.isArray(block.buttons)) {
          const { row, entries } = buildButtonRow(block.buttons, meta);
          components.push(row);
          allEntries.push(...entries);
        }
        if (block.select && typeof block.select === 'object') {
          const { row, entry } = buildSelectRow(block.select, meta);
          components.push(row);
          allEntries.push(entry);
        }
      }
    }
  }

  if (spec.modal && spec.modal.fields && spec.modal.fields.length > 0) {
    const triggerCustomId = _createId(COMPONENT_ID_PREFIX);
    const triggerBtn = new ButtonBuilder()
      .setLabel(spec.modal.triggerLabel || 'Open form')
      .setStyle(_mapButtonStyle(spec.modal.triggerStyle || 'primary'))
      .setCustomId(triggerCustomId);

    const triggerRow = new ActionRowBuilder().addComponents(triggerBtn);
    components.push(triggerRow);

    const { modal, modalEntry } = buildModal(spec.modal, triggerCustomId, meta);
    modalData = { modal, modalEntry, triggerId: triggerCustomId };

    const triggerEntry = {
      id: triggerCustomId,
      kind: 'modal-trigger',
      label: spec.modal.triggerLabel || 'Open form',
      modalId: modalEntry.id,
      ...meta,
    };
    registerComponent(triggerEntry);
    allEntries.push(triggerEntry);
  }

  return {
    content: spec.text || undefined,
    components,
    entries: allEntries,
    modal: modalData,
  };
}

function getRegistrySize() {
  return _registry.size;
}

function clearRegistry() {
  _registry.clear();
}

module.exports = {
  buildComponentSpec,
  buildButtonRow,
  buildSelectRow,
  buildModal,
  consumeComponent,
  peekComponent,
  consumeModal,
  registerComponent,
  getRegistrySize,
  clearRegistry,
  COMPONENT_ID_PREFIX,
  MODAL_ID_PREFIX,
  REGISTRY_TTL_MS,
  REGISTRY_MAX_SIZE,
};
