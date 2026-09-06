/**
 * What tables thought of their visit.
 *
 * A review is tied to an order and to nobody. That pairing is the whole design: it means
 * every score came from somebody who actually ate here, and it means a manager reading a
 * poor one can see what that table was served - without the restaurant ever holding a
 * name, because a guest is never asked for one.
 */

/** One review, as the restaurant reads it. */
export interface RestaurantReview {
  id: string;
  /** How the visit was overall, one to five. */
  rating: number;
  /** The food, or null if they did not say. */
  foodRating: number | null;
  /** The service, or null if they did not say. */
  serviceRating: number | null;
  /** What they wrote, or null. The only customer-authored text this product stores. */
  comment: string | null;
  submittedAtUtc: string;
  /** The order behind it, so a manager can open what that table was served. */
  orderId: string;
  orderNumber: number;
  tableName: string;
  /** Who served them, or null for an order a customer placed themselves. */
  servedByName: string | null;
}

/** The reviews a restaurant has, and what they add up to. */
export interface ReviewSummary {
  reviews: RestaurantReview[];
  /** How many there are in total, which is not the length of the list above. */
  count: number;
  /**
   * The mean overall score, or null when nobody has reviewed yet.
   *
   * Null rather than zero: nobody has rated this restaurant nothing, and a zero would
   * sort and read as the worst possible score.
   */
  averageRating: number | null;
  averageFoodRating: number | null;
  averageServiceRating: number | null;
}
