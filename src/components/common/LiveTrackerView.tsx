import { Box, Card, CardContent, Typography } from "@mui/material";
import { FunctionComponent } from "react";

const LiveTrackerView: FunctionComponent<{}> = () => {
    return (

        < Card sx={{ mt: 3 }
        }>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Live Tracker View
                </Typography>

                <Box
                    sx={{
                        position: "relative",
                        width: "100%",
                        paddingTop: "56.25%", // 16:9 aspect ratio
                    }}
                >
                    <Box
                        component="iframe"
                        src={process.env.REACT_APP_IFRAME_SOURCE}
                        title="Live Tracker"
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            border: 0,
                        }}
                        allow="fullscreen"
                    />
                </Box>
            </CardContent>
        </Card >
    );
}

export default LiveTrackerView;