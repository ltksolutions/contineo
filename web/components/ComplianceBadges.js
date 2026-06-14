import Icon from "./Icon";

export default function ComplianceBadges({ dict, lang }) {
  const c = dict.legal.compliance;
  const badges = [
    { icon: "scale", label: c.eupl, href: "https://eupl.eu/", external: true },
    { icon: "refresh", label: c.reuse, href: "https://reuse.software/", external: true },
    { icon: "shield", label: c.gdpr, href: `/${lang}/ochrana-udajov`, external: false },
    { icon: "eye", label: c.wcag, href: `/${lang}/pristupnost`, external: false },
  ];
  return (
    <div
      role="list"
      aria-label={c.heading}
      style={{ display: "flex", flexWrap: "wrap", gap: 10 }}
    >
      {badges.map((b, i) => (
        <a
          key={i}
          role="listitem"
          href={b.href}
          {...(b.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--ink)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "6px 12px",
          }}
        >
          <Icon name={b.icon} size={15} />
          {b.label}
        </a>
      ))}
    </div>
  );
}
