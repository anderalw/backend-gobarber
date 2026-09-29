import { Request, Response } from 'express';
import { container } from 'tsyringe';

import RevenueReportService from '@modules/appointments/services/RevenueReportService';
import InsightsService from '@modules/appointments/services/InsightsService';

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

  public async insights(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const insights = await container.resolve(InsightsService).execute({
      start: String(request.query.start),
      end: String(request.query.end),
    });

    return response.json(insights);
  }

  public async lostClients(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const clients = await container
      .resolve(InsightsService)
      .lostClients(Number(request.query.days));

    return response.json(clients);
  }
}
