import React, { useState } from "react";

export default function IntentInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const v = value.trim();
    if (!v) return;
    setValue("");
    onSubmit(v);
  }

  return (
    <div className="card">
      <input
        className="input"
        placeholder="State a claim or search a topic…"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
    </div>
  );
}

