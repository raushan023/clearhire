import type { ErrorRequestHandler } from 'express';

export const apiErrorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const issue = error as { type?: string } | null;
    if (issue?.type === 'charset.unsupported' || issue?.type === 'encoding.unsupported') {
        return res.status(415).json({ message: 'Unsupported request charset or content encoding' });
    }
    if (issue?.type === 'entity.too.large') return res.status(413).json({ message: 'Request body exceeds the allowed size' });
    if (issue?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' });
    console.error('Unhandled API request failure');
    return res.status(500).json({ message: 'Internal server error' });
};
