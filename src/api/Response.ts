import { AxiosResponse } from 'axios'
import { Model, Record, Collections } from '@vuex-orm/core'
import { Config, PersistMethods, PersistOptions } from '../contracts/Config'

export class Response {
  /**
   * The model that called the request.
   */
  model: typeof Model

  /**
   * The request configuration.
   */
  config: Config

  /**
   * The axios response instance.
   */
  response: AxiosResponse

  /**
   * Entities created by Vuex ORM.
   */
  entities: Collections | null = null

  /**
   * Whether if response data is saved to the store or not.
   */
  isSaved: boolean = false

  /**
   * Create a new response instance.
   */
  constructor(model: typeof Model, config: Config, response: AxiosResponse) {
    this.model = model
    this.config = config
    this.response = response
  }

  /**
   * Save response data to the store.
   */
  async save(): Promise<void> {
    const data = this.getDataFromResponse()

    if (!this.validateData(data)) {
      console.warn(
        '[Vuex ORM Axios] The response data could not be saved to the store ' +
          'because it is not an object or an array. You might want to use ' +
          '`dataTransformer` option to handle non-array/object response ' +
          'before saving it to the store.'
      )

      return
    }

    let method: PersistMethods = this.config.persistBy || 'insertOrUpdate'

    if (!this.validatePersistAction(method)) {
      console.warn(
        '[Vuex ORM Axios] The "persistBy" option configured is not a ' +
          'recognized value. Response data will be persisted by the ' +
          'default `insertOrUpdate` method.'
      )

      method = 'insertOrUpdate'
    }

    const options = this.getPersistOptions()

    this.entities = await this.model[method as string]({ data, ...options })

    this.isSaved = true
  }

  /**
   * Delete the entity record where the `delete` option is configured.
   */
  async delete(): Promise<void> {
    if (this.config.delete === undefined) {
      throw new Error(
        '[Vuex ORM Axios] Could not delete records because the `delete` option is not set.'
      )
    }

    await this.model.delete(this.config.delete as any)
  }

  /**
   * Get the response data from the axios response object. If a `dataTransformer`
   * option is configured, it will be applied to the response object. If the
   * `dataKey` option is configured, it will return the data from the given
   * property within the response body.
   */
  getDataFromResponse(): Record | Record[] {
    if (this.config.dataTransformer) {
      return this.config.dataTransformer(this.response)
    }

    if (this.config.dataKey) {
      return this.response.data[this.config.dataKey]
    }

    return this.response.data
  }

  /**
   * Get persist options if any set in config.
   */
  protected getPersistOptions(): PersistOptions | undefined {
    const persistOptions = this.config.persistOptions

    if (!persistOptions || typeof persistOptions !== 'object') {
      return
    }

    return Object.keys(persistOptions)
      .filter(this.validatePersistAction) // Filter to avoid polluting the payload.
      .reduce((carry, key) => {
        carry[key] = persistOptions[key]
        return carry
      }, {})
  }

  /**
   * Validate the given data to ensure the Vuex ORM persist methods accept it.
   */
  protected validateData(data: any): data is Record | Record[] {
    return data !== null && typeof data === 'object'
  }

  /**
   * Validate the given string as to ensure it correlates with the available
   * Vuex ORM persist methods.
   */
  protected validatePersistAction(action: string): action is PersistMethods {
    return ['create', 'insert', 'update', 'insertOrUpdate'].includes(action)
  }
}
