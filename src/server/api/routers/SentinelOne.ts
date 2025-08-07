import { z } from "zod";
import { env } from "~/env";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const sentinelOneRouter = createTRPCRouter({
  loginByApiToken: protectedProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const response = await fetch(
        `${env.SENTINELONE_ENDPOINT}/web/api/v2.1/users/login/by-api-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `ApiToken ${input.apiKey}`,
          },
          body: JSON.stringify({}), // SentinelOne expects an empty object
        },
      );

      if (!response.ok) {
        throw new Error(
          `SentinelOne login failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data;
    }),
});
