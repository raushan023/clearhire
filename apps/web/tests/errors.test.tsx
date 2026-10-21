import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "../src/lib/api-client";
import { ErrorState } from "../src/components/ui";
test("business conflicts render server messages and field errors without HTML injection", () => {
  const html = renderToStaticMarkup(
    <ErrorState
      error={
        new ApiError(
          409,
          "All openings already have pending or accepted offers. <script>unsafe</script>",
          { openings: ["Choose more openings."] },
        )
      }
    />,
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /All openings already/);
  assert.match(html, /Choose more openings/);
  assert.ok(!html.includes("<script>"));
});
test("storage 503 renders an explicit configuration error without claiming success", () => {
  const html = renderToStaticMarkup(
    <ErrorState
      error={new ApiError(503, "Resume storage is not configured")}
    />,
  );
  assert.match(html, /Resume storage is not configured in this environment/);
});
