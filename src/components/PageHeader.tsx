import "./PageHeader.css";

interface Props {
  crumbs: string[];
  title: string;
}

export function PageHeader({ crumbs, title }: Props) {
  return (
    <div className="page-header">
      <div className="breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={crumb} className="breadcrumb-segment">
            <span className={i < crumbs.length - 1 ? "breadcrumb-link" : "breadcrumb-current"}>
              {crumb}
            </span>
            {i < crumbs.length - 1 && <span className="breadcrumb-sep">/</span>}
          </span>
        ))}
      </div>
      <div className="title-row">
        <h1 className="page-title">{title}</h1>
        <button type="button" className="btn btn-outline">
          Export CSV
        </button>
        <button type="button" className="btn btn-primary">
          Bulk activation
        </button>
      </div>
    </div>
  );
}
