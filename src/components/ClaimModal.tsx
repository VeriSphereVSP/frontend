import ArticleView from "./ArticleView";
import ClaimCard from "./ClaimCard";
import { Article, Claim } from "../types";

export default function ClaimModal({
  content,
  onClose,
}: {
  content: Claim | Article;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 440 }}>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        {"sections" in content ? (
          <ArticleView article={content} />
        ) : (
          <ClaimCard card={content as any} />
        )}
      </div>
    </div>
  );
}

