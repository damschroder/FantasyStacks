const configuredBuild = Number(process.env.NEXT_PUBLIC_APP_BUILD);
export const APP_BUILD = Number.isSafeInteger(configuredBuild) && configuredBuild > 0 ? configuredBuild : 0;
