import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function (pi: ExtensionAPI): void {
  pi.registerTranscriptPresenter(block =>
    block.type === "toolCall" ? "compact" : undefined,
  );
}
