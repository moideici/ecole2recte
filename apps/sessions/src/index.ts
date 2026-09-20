export { SessionDurableObject } from './session-durable-object.js'

/**
 * Ce worker n'est jamais appelé directement : `apps/web` s'adresse à son Durable Object
 * par un lien externe (`script_name` dans son `wrangler.toml`). Le point d'entrée HTTP ne
 * sert donc qu'à satisfaire Cloudflare, qui exige un export par défaut.
 */
export default {
  async fetch(): Promise<Response> {
    return new Response('Ce worker n’héberge que le Durable Object des sessions ecole2recte.', {
      status: 404,
    })
  },
}
