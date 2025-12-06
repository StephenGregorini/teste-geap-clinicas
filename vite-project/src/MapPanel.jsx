import { Wrapper } from "@googlemaps/react-wrapper";
import MapContent from "./MapContent";

const GOOGLE_MAPS_API_KEY = "AIzaSyASJWlQc1VSo8EHrzItuTwrUP2u7pl_EfQ";
const MAP_ID = "607797b0d3c21f5f8ef4fb34";

function MapPanelComponent({
  clinicas,
  selectedClinica,
  onSelect,
  userLocation,
}) {
  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden relative">
      <Wrapper
        apiKey={GOOGLE_MAPS_API_KEY}
        libraries={["marker"]}
      >
        <MapContent
          clinicas={clinicas}
          selectedClinica={selectedClinica}
          onSelect={onSelect}
          userLocation={userLocation}
          mapId={MAP_ID}
        />
      </Wrapper>
    </div>
  );
}

export default MapPanelComponent;
