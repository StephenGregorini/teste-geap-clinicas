export default function PillMarker({ text }) {
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 14px",
        backgroundColor: "#FFFFFF",
        borderRadius: "999px",
        border: "1px solid rgba(15, 20, 36, 0.12)",
        boxShadow: "0 4px 10px rgba(15, 20, 36, 0.15)",
        fontSize: "13px",
        fontWeight: 700,
        color: "#0F1424",
        whiteSpace: "nowrap",
      }}
    >
      {text}

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "-6px",
          transform: "translateX(-50%) rotate(45deg)",
          width: "10px",
          height: "10px",
          backgroundColor: "#FFFFFF",
          borderRight: "1px solid rgba(15, 20, 36, 0.12)",
          borderBottom: "1px solid rgba(15, 20, 36, 0.12)",
          boxShadow: "0 3px 6px rgba(15, 20, 36, 0.12)",
        }}
      />
    </div>
  );
}
