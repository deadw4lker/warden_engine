export default function Logo({
  variant = "dark",
  height = 28,
}) {
  const src =
    variant === "light"
      ? "/warden-logo-light.png"
      : "/warden-logo-dark.png";

  return (
    <img
      src={src}
      alt="WARDEN"
      height={height}
      style={{
        width: "auto",
        height: `${height}px`,
        objectFit: "contain",
        display: "block",
      }}
      draggable={false}
    />
  );
}
