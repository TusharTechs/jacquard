// The opening Story (studio-experience Requirement 10). First cut: the framing line and the way in.
// The scroll story is built in wave 3.
import { hrefFor } from "../../lib/route";

export function Story() {
  return (
    <main className="story">
      <a className="story-skip" href={hrefFor({ page: "studio", step: "design" })}>
        Skip to the studio
      </a>
      <h1>Punch cards are dead as a computing medium.</h1>
      <p>Handlooms never stopped using them.</p>
      <a className="btn btn-primary" href={hrefFor({ page: "studio", step: "design" })}>
        Open the studio
      </a>
    </main>
  );
}
