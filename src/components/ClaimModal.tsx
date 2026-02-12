import ClaimCard from "./ClaimCard";
import type { ClaimCard as ClaimCardT } from "../types";

type ClaimModalProps = {
  claim: ClaimCardT;
  onClose: () => void;
  onCreate?: (text: string) => void;
  onStake?: (claimId: number, side: "support" | "challenge", amount: number) => void;
};

export default function ClaimModal({ claim, onClose, onCreate, onStake }: ClaimModalProps) {
  return (
    <div className="modal-backdrop">
      <div className="modal claim-modal">
        <ClaimCard
          card={claim}
          onCreate={onCreate}
          onStake={onStake}
        />
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
