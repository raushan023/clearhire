import { respondToClientError } from "../../utils/client-error.js";
import type { Response } from "express";

import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

import { createJobSchema, jobIdParamSchema, updateJobSchema, jobSearchSchema, employerJobSearchSchema, updateJobStatusSchema, cancelJobSchema, repostJobSchema } from "./job.schema.js";
import { createJob, getJobById, publishJob, updateJob, searchJobs, getEmployerJobs, updateJobStatus, cancelJob, repostJob } from "./job.service.js";

export async function createJobController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const validationResult = createJobSchema.safeParse(req.body);

    if (!validationResult.success) {
        return res.status(400).json({
            message: "Invalid job data",
            errors: validationResult.error.flatten().fieldErrors,
        });
    }

    try {
        const job = await createJob(
            req.user.id,
            validationResult.data
        );

        return res.status(201).json({
            message: "Job created successfully",
            job,
        });
    } catch (error) {
        if (respondToClientError(error, res)) return;
        if (
            error instanceof Error &&
            error.message === "COMPANY_ACCESS_DENIED"
        ) {
            return res.status(403).json({
                message: "You do not have access to this company",
            });
        }

        console.error("Job creation failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function publishJobController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult = jobIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid job ID",
        });
    }

    try {
        const job = await publishJob(
            req.user.id,
            paramsResult.data.jobId
        );

        return res.status(200).json({
            message: "Job published successfully",
            job,
        });
    } catch (error) {
        if (respondToClientError(error, res)) return;
        if (error instanceof Error) {
            if (error.message === "JOB_ACCESS_DENIED") {
                return res.status(403).json({
                    message: "You do not have access to this job",
                });
            }

            if (error.message === "JOB_NOT_DRAFT") {
                return res.status(409).json({
                    message: "Only draft jobs can be published",
                });
            }

            if (
                error.message === "APPLICATION_DEADLINE_PASSED"
            ) {
                return res.status(409).json({
                    message:
                        "The application deadline must be in the future before publishing",
                });
            }

            if (error.message === "JOB_INCOMPLETE") {
                return res.status(409).json({
                    message: "Job must have at least one required skill before publishing",
                });
            }
        }

        console.error("Job publishing failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function updateJobController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult = jobIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid job ID",
        });
    }

    const validationResult = updateJobSchema.safeParse(req.body);

    if (!validationResult.success) {
        return res.status(400).json({
            message: "Invalid job data",
            errors: validationResult.error.flatten().fieldErrors,
        });
    }

    try {
        const job = await updateJob(
            req.user.id,
            paramsResult.data.jobId,
            validationResult.data
        );

        return res.status(200).json({
            message: "Job updated successfully",
            job,
        });
    } catch (error) {
        if (respondToClientError(error, res)) return;
        if (error instanceof Error) {
            switch (error.message) {
                case "JOB_ACCESS_DENIED":
                    return res.status(403).json({
                        message: "You do not have access to this job",
                    });

                case "OPENINGS_BELOW_OCCUPIED_CAPACITY":
                    return res.status(409).json({ message: "Openings cannot be fewer than pending and accepted offers" });

                case "JOB_NOT_EDITABLE":
                    return res.status(409).json({
                        message: "This job can no longer be edited",
                    });

                case "INVALID_EXPERIENCE_RANGE":
                    return res.status(400).json({
                        message:
                            "Maximum experience cannot be less than minimum experience",
                    });

                case "INVALID_SALARY_RANGE":
                    return res.status(400).json({
                        message:
                            "Maximum salary cannot be less than minimum salary",
                    });

                case "INVALID_DEADLINE_RANGE":
                    return res.status(400).json({
                        message:
                            "Decision deadline must be after application deadline",
                    });

                case "INVALID_APPLICATION_DEADLINE":
                    return res.status(400).json({
                        message:
                            "Application deadline must be in the future for an open job",
                    });

                case "REQUIRED_SKILL_MISSING":
                    return res.status(400).json({
                        message:
                            "At least one required skill is required",
                    });

                case "DUPLICATE_SKILLS":
                    return res.status(400).json({
                        message:
                            "Skill lists cannot contain duplicates",
                    });

                case "SKILL_TYPE_CONFLICT":
                    return res.status(400).json({
                        message:
                            "A skill cannot be both required and preferred",
                    });
            }
        }

        console.error("Job update failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function getJobController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult = jobIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid job ID",
        });
    }

    try {
        const job = await getJobById(
            req.user.id,
            req.user.role,
            paramsResult.data.jobId
        );

        return res.status(200).json({
            job,
        });
    } catch (error) {
        if (respondToClientError(error, res)) return;
        if (error instanceof Error) {
            if (error.message === "JOB_NOT_FOUND") {
                return res.status(404).json({
                    message: "Job not found",
                });
            }

            if (error.message === "JOB_NOT_ACCESSIBLE") {
                return res.status(403).json({
                    message: "You do not have access to this job",
                });
            }
        }

        console.error("Fetching job failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function searchJobsController(
    req: AuthenticatedRequest,
    res: Response
) {
    const validationResult =
        jobSearchSchema.safeParse(req.query);

    if (!validationResult.success) {
        return res.status(400).json({
            message: "Invalid search parameters",
            errors:
                validationResult.error.flatten().fieldErrors,
        });
    }

    try {
        const result = await searchJobs(
            validationResult.data
        );

        return res.status(200).json(result);
    } catch (error) {
        if (respondToClientError(error, res)) return;
        console.error("Job search failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function getEmployerJobsController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const validationResult =
        employerJobSearchSchema.safeParse(req.query);

    if (!validationResult.success) {
        return res.status(400).json({
            message: "Invalid search parameters",
            errors:
                validationResult.error.flatten().fieldErrors,
        });
    }

    try {
        const result = await getEmployerJobs(
            req.user.id,
            validationResult.data
        );

        return res.status(200).json(result);
    } catch (error) {
        if (respondToClientError(error, res)) return;
        console.error(
            "Fetching employer jobs failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function updateJobStatusController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult =
        jobIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid job ID",
        });
    }

    const bodyResult =
        updateJobStatusSchema.safeParse(req.body);

    if (!bodyResult.success) {
        return res.status(400).json({
            message: "Invalid job status",
            errors:
                bodyResult.error.flatten().fieldErrors,
        });
    }

    try {
        const job = await updateJobStatus(
            req.user.id,
            paramsResult.data.jobId,
            bodyResult.data
        );

        return res.status(200).json({
            message: "Job status updated successfully",
            job,
        });
    } catch (error) {
        if (respondToClientError(error, res)) return;
        if (error instanceof Error) {
            switch (error.message) {
                case "JOB_ACCESS_DENIED":
                    return res.status(403).json({
                        message:
                            "You do not have access to this job",
                    });

                case "INVALID_JOB_STATUS_TRANSITION":
                    return res.status(409).json({
                        message:
                            "This job status transition is not allowed",
                    });

                case "UNRESOLVED_APPLICATIONS_EXIST":
                    return res.status(409).json({
                        message:
                            "All active applications must receive an outcome before the job can be marked as filled",
                    });

                case "OPENINGS_NOT_FILLED":
                    return res.status(409).json({
                        message:
                            "The job cannot be marked as filled until all openings have accepted offers",
                    });
            }
        }

        console.error(
            "Job status update failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function cancelJobController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult =
        jobIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid job ID",
        });
    }

    const bodyResult =
        cancelJobSchema.safeParse(req.body);

    if (!bodyResult.success) {
        return res.status(400).json({
            message: "Invalid cancellation data",
            errors:
                bodyResult.error.flatten()
                    .fieldErrors,
        });
    }

    try {
        const job = await cancelJob(
            req.user.id,
            paramsResult.data.jobId,
            bodyResult.data
        );

        return res.status(200).json({
            message:
                "Job cancelled successfully",
            job,
        });
    } catch (error) {
        if (respondToClientError(error, res)) return;
        if (error instanceof Error) {
            switch (error.message) {
                case "JOB_ACCESS_DENIED":
                    return res.status(403).json({
                        message:
                            "You do not have access to this job",
                    });

                case "JOB_NOT_CANCELLABLE":
                    return res.status(409).json({
                        message:
                            "This job can no longer be cancelled",
                    });

                case "ACCEPTED_OFFER_EXISTS":
                    return res.status(409).json({
                        message:
                            "A job with an accepted offer cannot be cancelled through the normal cancellation flow",
                    });
            }
        }

        console.error(
            "Job cancellation failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function repostJobController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message:
                "Authentication required",
        });
    }

    const paramsResult =
        jobIdParamSchema.safeParse(
            req.params
        );

    if (!paramsResult.success) {
        return res.status(400).json({
            message:
                "Invalid job ID",
        });
    }

    const bodyResult =
        repostJobSchema.safeParse(
            req.body
        );

    if (!bodyResult.success) {
        return res.status(400).json({
            message:
                "Invalid repost data",
            errors:
                bodyResult.error.flatten()
                    .fieldErrors,
        });
    }

    try {
        const job = await repostJob(
            req.user.id,
            paramsResult.data.jobId,
            bodyResult.data
        );

        return res.status(201).json({
            message:
                "Job repost created successfully",
            job,
        });
    } catch (error) {
        if (respondToClientError(error, res)) return;
        if (error instanceof Error) {
            switch (error.message) {
                case "JOB_ACCESS_DENIED":
                    return res.status(403).json({
                        message:
                            "You do not have access to this job",
                    });

                case "JOB_NOT_REPOSTABLE":
                    return res.status(409).json({
                        message:
                            "Only terminal jobs can be reposted",
                    });
            }
        }

        console.error(
            "Job repost failed:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error",
        });
    }
}