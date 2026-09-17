import "./PageHeader.css";

interface Props {
  title: string;
  subtitle: string;
}

export function PageHeader({ title, subtitle }: Props) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <button type="button" className="btn btn-soft">
        Export CSV
      </button>
      <button type="button" className="btn btn-solid">
        Bulk activation
      </button>
    </div>
  );
}
