import { Composition } from "remotion";
import { Main } from "./Main";

export function Root() {
  return (
    <Composition
      component={Main}
      durationInFrames={150}
      fps={30}
      height={1080}
      id="Main"
      width={1920}
    />
  );
}
