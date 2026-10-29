jest.mock("@/lib/http-client", () => ({
  serviceRequest: jest.fn(),
}));

import { serviceRequest } from "@/lib/http-client";
import { deleteMovie } from "@/services/radarr-api";
import { deleteSeries } from "@/services/sonarr-api";
import { deleteArtist } from "@/services/lidarr-api";

const mockRequest = serviceRequest as jest.Mock;

beforeEach(() => {
  mockRequest.mockReset();
  mockRequest.mockResolvedValue(undefined);
});

// The "Add List Exclusion" delete option (#472) is spelled differently per
// service, and a wrong name is silently ignored upstream: the delete succeeds
// and no exclusion is added. Radarr reads `addImportExclusion`
// (MovieController.DeleteMovie); Sonarr and Lidarr read `addImportListExclusion`.
describe("*arr library delete params", () => {
  it("Radarr sends addImportExclusion next to deleteFiles", async () => {
    await deleteMovie(7, { deleteFiles: true, addExclusion: true }, "inst-1");

    expect(mockRequest).toHaveBeenCalledWith("radarr", "/movie/7", {
      method: "DELETE",
      params: { deleteFiles: true, addImportExclusion: true },
      instanceId: "inst-1",
    });
  });

  it("Sonarr sends addImportListExclusion next to deleteFiles", async () => {
    await deleteSeries(12, { deleteFiles: true, addExclusion: true }, "inst-2");

    expect(mockRequest).toHaveBeenCalledWith("sonarr", "/series/12", {
      method: "DELETE",
      params: { deleteFiles: true, addImportListExclusion: true },
      instanceId: "inst-2",
    });
  });

  it("Lidarr sends addImportListExclusion next to deleteFiles", async () => {
    await deleteArtist(3, { deleteFiles: false, addExclusion: true }, "inst-3");

    expect(mockRequest).toHaveBeenCalledWith("lidarr", "/artist/3", {
      method: "DELETE",
      params: { deleteFiles: false, addImportListExclusion: true },
      instanceId: "inst-3",
    });
  });

  it("sends both flags as false when no options are given", async () => {
    await deleteMovie(1);
    await deleteSeries(2);
    await deleteArtist(3);

    expect(mockRequest).toHaveBeenNthCalledWith(1, "radarr", "/movie/1", {
      method: "DELETE",
      params: { deleteFiles: false, addImportExclusion: false },
      instanceId: undefined,
    });
    expect(mockRequest).toHaveBeenNthCalledWith(2, "sonarr", "/series/2", {
      method: "DELETE",
      params: { deleteFiles: false, addImportListExclusion: false },
      instanceId: undefined,
    });
    expect(mockRequest).toHaveBeenNthCalledWith(3, "lidarr", "/artist/3", {
      method: "DELETE",
      params: { deleteFiles: false, addImportListExclusion: false },
      instanceId: undefined,
    });
  });

  it("keeps the exclusion off when only deleteFiles is set", async () => {
    await deleteMovie(5, { deleteFiles: true });

    expect(mockRequest).toHaveBeenCalledWith("radarr", "/movie/5", {
      method: "DELETE",
      params: { deleteFiles: true, addImportExclusion: false },
      instanceId: undefined,
    });
  });
});
