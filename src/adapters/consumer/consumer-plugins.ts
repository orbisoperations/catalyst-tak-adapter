export function createRTSPConnectionDetailItemPlugin(
  rtspUrl: string,
  rtspPort: string,
  rtspStreamPath: string,
  callsign: string,
): object {
  return {
    __video: {
      _attributes: {
        uid: callsign,
        url: `rtsp://${rtspUrl}:${rtspPort}${rtspStreamPath}`,
      },
      ConnectionEntry: {
        _attributes: {
          networkTimeout: "5000",
          uid: callsign,
          path: rtspStreamPath,
          protocol: "rtsp",
          bufferTime: "-1",
          address: rtspUrl,
          port: rtspPort,
          roverPort: "-1",
          rtspReliable: "1",
          ignoreEmbbededKLV: "false",
          alias: "live/" + callsign,
        },
      },
    },
  };
}
