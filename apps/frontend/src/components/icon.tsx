export function Icon({
  name,
  className = "",
}: {
  name:
    | "back"
    | "forward"
    | "arrow"
    | "globe"
    | "person"
    | "shield"
    | "page"
    | "alert";
  className?: string;
}) {
  const paths = {
    back: "m14 6-6 6 6 6M8 12h12",
    forward: "m10 6 6 6-6 6M4 12h12",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    globe:
      "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
    person: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
    page: "M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 13h8m-8 4h6",
    alert: "M12 8v5m0 4h.01M3 20h18L12 3 3 20Z",
  };
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
