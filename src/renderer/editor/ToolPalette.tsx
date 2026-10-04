import { useMemo, useState } from 'react';
import { CATEGORY_ICONS, CATEGORY_ORDER, TOOLS, searchTools, type Tool, type ToolCategory } from '../../shared/editor/tools';
import { useT } from '../app/i18n';
import { useStudio } from '../app/store';
import { Icon, isIconName } from '../components/Icon';
import { runTool } from './actions';

export function ToolPalette() {
  const t = useT();
  const beginner = useStudio((s) => s.settings?.beginnerMode ?? true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<ToolCategory>>(() => new Set(['background', 'effects']));

  const results = useMemo(() => (query.trim() ? searchTools(query, (tool) => `${t(`tool.${tool.id}.title`)} ${t(`tool.${tool.id}.desc`)}`) : null), [query, t]);
  const popular = useMemo(() => TOOLS.filter((tool) => tool.popular), []);

  const toggle = (c: ToolCategory) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <aside className="panel tool-palette">
      <div className="panel-title">{t('editor.tools')}</div>
      <label className="search-box tool-search">
        <Icon name="search" size={16} />
        <input placeholder={t('editor.searchTools')} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={beginner} />
      </label>

      {results ? (
        <div className="tool-list">
          {results.length === 0 ? <div className="muted small pad">{t('editor.noToolsFound')}</div> : results.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
        </div>
      ) : (
        <div className="tool-scroll">
          {beginner && (
            <section className="tool-group">
              <div className="tool-group-title static">
                <span className="with-icon">
                  <Icon name="star" size={15} /> {t('editor.popular')}
                </span>
              </div>
              <div className="tool-tiles">
                {popular.map((tool) => (
                  <ToolTile key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          )}
          {CATEGORY_ORDER.map((category) => {
            const tools = TOOLS.filter((tool) => tool.category === category);
            const isOpen = open.has(category);
            return (
              <section key={category} className="tool-group">
                <button type="button" className="tool-group-title" onClick={() => toggle(category)} aria-expanded={isOpen}>
                  <span className="with-icon">
                    <ToolGlyph name={CATEGORY_ICONS[category]} size={16} /> {t(`category.${category}`)}
                  </span>
                  <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={15} className="chev" />
                </button>
                {isOpen && (
                  <div className="tool-list">
                    {tools.map((tool) => (
                      <ToolCard key={tool.id} tool={tool} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const t = useT();
  return (
    <button type="button" className="tool-card" onClick={() => void runTool(tool, t)} title={t(`tool.${tool.id}.desc`)}>
      <span className="tool-icon">
        <ToolGlyph name={tool.icon} size={22} />
      </span>
      <span className="tool-text">
        <strong>{t(`tool.${tool.id}.title`)}</strong>
        <span>{t(`tool.${tool.id}.desc`)}</span>
      </span>
    </button>
  );
}

function ToolTile({ tool }: { tool: Tool }) {
  const t = useT();
  return (
    <button type="button" className="tool-tile" onClick={() => void runTool(tool, t)} title={t(`tool.${tool.id}.desc`)}>
      <span className="tool-icon">
        <ToolGlyph name={tool.icon} size={22} />
      </span>
      <span>{t(`tool.${tool.id}.title`)}</span>
    </button>
  );
}

function ToolGlyph({ name, size }: { name: string; size: number }) {
  return <Icon name={isIconName(name) ? name : 'sparkles'} size={size} strokeWidth={1.7} />;
}
