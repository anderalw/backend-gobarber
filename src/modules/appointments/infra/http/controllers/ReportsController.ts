import { Request, Response } from 'express';
import { container } from 'tsyringe';

import RevenueReportService from '@modules/appointments/services/RevenueReportService';

export default class ReportsController {
  public async revenue(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const report = await container.resolve(RevenueReportService).execute({
      start: String(request.query.start),
      end: String(request.query.end),
    });

    return response.json(report);
  }
}
